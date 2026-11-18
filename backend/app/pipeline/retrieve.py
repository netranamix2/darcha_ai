"""Step 4: hybrid search (section 9).

top-8 by vectors (bge-m3, pgvector HNSW) + top-8 by keywords (Postgres full text)
-> Reciprocal Rank Fusion -> cross-encoder rerank -> top-4. Only documents with status=active.
"""
from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass

from sqlalchemy import func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import RETRIEVE_FINAL, RETRIEVE_PER_METHOD, VEC_SIM_FLOOR, VEC_SIM_FULL
from app.db.models import Chunk, Document
from app.kb import embed

RRF_K = 60
_STOP = {"va", "bilan", "uchun", "qanday", "qachon", "nima", "kerak", "mumkinmi", "mumkin", "bu", "men", "menga",
         "bo'ladi", "bolsa", "ham", "yoki", "kak", "chto", "gde", "ili", "dlya", "eto", "mne", "ne", "na", "po"}


@dataclass
class Hit:
    chunk_id: int
    document_id: int
    title: str
    number: str | None
    source_url: str | None
    article_ref: str
    header: str
    text: str
    vec_sim: float = 0.0
    rrf: float = 0.0
    score: float = 0.0   # final relevance 0..1 (reranker if enabled, else vector similarity)

    @property
    def support(self) -> float:
        """How strongly this fragment supports an answer, 0..1, for the confidence formula.
        The cross-encoder is calibrated within one language but gives tiny absolute scores for
        Russian question -> Uzbek passage (0.03 for the right passage), so take the max with a
        calibrated vector similarity (VEC_SIM_FLOOR/FULL in .env; tune with run_eval.py on the real KB)."""
        vec = min(1.0, max(0.0, (self.vec_sim - VEC_SIM_FLOOR) / (VEC_SIM_FULL - VEC_SIM_FLOOR)))
        return max(self.score, vec)

    def citation(self) -> dict:
        title = f"{self.title}" + (f" №{self.number}" if self.number else "")
        return {"chunk_id": str(self.chunk_id), "title": title, "ref": self.article_ref, "url": self.source_url}


def keyword_query(text_latin: str) -> str:
    """Prefix tsquery that tolerates Uzbek suffixes: o'qishni -> oqish:* (apostrophes are removed in the index)."""
    words = re.findall(r"[a-z0-9]+", text_latin.replace("'", ""))
    terms = []
    for w in words:
        if w in _STOP or len(w) < 3:
            continue
        if w.isdigit():
            terms.append(w)
        else:
            stem = w[: max(4, len(w) - 3)] if len(w) > 5 else w
            terms.append(f"{stem}:*")
    return " | ".join(dict.fromkeys(terms))


def _hit(c: Chunk, d: Document) -> Hit:
    return Hit(c.id, d.id, d.title, d.number, d.source_url, c.article_ref, c.header, c.text)


def semantic_text(text_masked: str, text_latin: str, lang: str | None) -> str:
    """What to embed: bge-m3 understands Russian in Cyrillic far better than transliterated Russian
    (measured: 0.60 vs 0.39 similarity to the right Uzbek passage), while Uzbek works best in Latin."""
    return text_masked if lang in ("ru", "mixed") else text_latin


async def retrieve(s: AsyncSession, text_latin: str, k: int = RETRIEVE_FINAL, semantic: str | None = None) -> list[Hit]:
    """text_latin drives keyword search; `semantic` (defaults to text_latin) drives vectors and reranking."""
    semantic = semantic or text_latin
    qvec = await asyncio.to_thread(embed.embed_one, semantic)

    dist = Chunk.embedding.cosine_distance(qvec)
    vec_rows = (await s.execute(
        select(Chunk, Document, dist.label("dist"))
        .join(Document, Document.id == Chunk.document_id)
        .where(Document.status == "active")
        .order_by(dist).limit(RETRIEVE_PER_METHOD)
    )).all()

    kw_rows = []
    tsq = keyword_query(text_latin)
    if tsq:
        query = func.to_tsquery(literal_column("'simple'::regconfig"), tsq)
        rank = func.ts_rank_cd(Chunk.tsv, query)
        kw_rows = (await s.execute(
            select(Chunk, Document, rank.label("rank"))
            .join(Document, Document.id == Chunk.document_id)
            .where(Document.status == "active", Chunk.tsv.op("@@")(query))
            .order_by(rank.desc()).limit(RETRIEVE_PER_METHOD)
        )).all()

    hits: dict[int, Hit] = {}
    for rank_i, (c, d, dist_v) in enumerate(vec_rows):
        h = hits.setdefault(c.id, _hit(c, d))
        h.vec_sim = 1 - float(dist_v)
        h.rrf += 1 / (RRF_K + rank_i + 1)
    for rank_i, (c, d, _) in enumerate(kw_rows):
        h = hits.setdefault(c.id, _hit(c, d))
        h.rrf += 1 / (RRF_K + rank_i + 1)
    if not hits:
        return []

    candidates = sorted(hits.values(), key=lambda h: h.rrf, reverse=True)
    rr = await asyncio.to_thread(embed.rerank, semantic, [f"{h.header}\n{h.text}" for h in candidates])
    if rr is not None:
        for h, sc in zip(candidates, rr):
            h.score = float(sc)
        candidates.sort(key=lambda h: h.score, reverse=True)
    else:
        for h in candidates:
            h.score = h.vec_sim
    return candidates[:k]
