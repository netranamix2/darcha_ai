"""Load documents into the knowledge base: read -> chunk -> transliterate -> embed -> store.

data/documents/meta.yaml describes every file:

    - file: oqishni_kochirish.txt
      title: "Oliy ta'lim muassasalarida o'qishni ko'chirish tartibi to'g'risidagi Nizom"
      number: "VMQ-XXX"
      issued_at: "2023-01-01"
      status: active              # active | repealed
      source_url: https://lex.uz/docs/XXXX
      lang: uz
      doc_type: regulation        # regulation | faq
      valid_until: "2026-11-01"   # optional: one-off rules (deadline extensions) drop out of search after this date
"""
from __future__ import annotations

import asyncio
from pathlib import Path

import yaml
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Chunk, Document
from app.kb import embed
from app.kb.chunk import Piece, chunk_document
from app.kb.translit import to_search_form


def read_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader
        return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
    raw = path.read_text(encoding="utf-8", errors="ignore")
    if suffix in {".html", ".htm"}:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(raw, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer"]):
            tag.decompose()
        return soup.get_text("\n")
    return raw


async def store_chunks(s: AsyncSession, doc: Document, pieces: list[Piece]) -> int:
    await s.execute(delete(Chunk).where(Chunk.document_id == doc.id))
    if not pieces:
        return 0
    # The embedded text includes the header, so "kontrakt" in a title helps matching.
    latin = [to_search_form(f"{p.header}\n{p.text}") for p in pieces]
    vectors = await asyncio.to_thread(embed.embed, latin)
    s.add_all(
        Chunk(document_id=doc.id, article_ref=p.article_ref, header=p.header, text=p.text,
              text_latin=lt, embedding=v.tolist())
        for p, lt, v in zip(pieces, latin, vectors)
    )
    return len(pieces)


async def ingest_text(s: AsyncSession, text: str, meta: dict) -> tuple[Document, int]:
    """Create or replace a document (matched by file name or title) and index it."""
    q = select(Document).where(Document.file == meta["file"]) if meta.get("file") else \
        select(Document).where(Document.title == meta["title"])
    doc = (await s.execute(q)).scalar_one_or_none()
    if doc is None:
        doc = Document(title=meta["title"])
        s.add(doc)
    for key in ("title", "number", "issued_at", "status", "source_url", "lang", "doc_type", "file", "valid_until"):
        if meta.get(key) is not None:
            setattr(doc, key, str(meta[key]))
    await s.flush()
    pieces = chunk_document(text, doc.title)
    n = await store_chunks(s, doc, pieces)
    return doc, n


async def ingest_folder(s: AsyncSession, folder: Path, only: set[str] | None = None) -> list[tuple[str, int]]:
    """only: index just these files (paths relative to folder, or bare names like KB-040.txt)."""
    # Every meta.yaml (the root one and any in subfolders, e.g. lex/ and faq/) describes the files next to it.
    by_file = {}
    for meta_path in sorted(folder.rglob("meta.yaml")):
        base = meta_path.parent.relative_to(folder)
        for m in yaml.safe_load(meta_path.read_text(encoding="utf-8")) or []:
            rel = str(base / m["file"]) if str(base) != "." else m["file"]
            by_file[rel] = {**m, "file": rel}
    results = []
    for path in sorted(folder.rglob("*")):
        # skip "_report.md", "_cache/..." (raw downloaded pages) and READMEs
        if path.suffix.lower() not in {".txt", ".md", ".html", ".htm", ".pdf"} \
                or any(part.startswith("_") for part in path.relative_to(folder).parts) \
                or path.stem.upper() == "README":
            continue
        rel = str(path.relative_to(folder))
        if only and rel not in only and path.name not in only:
            continue
        meta = {"file": rel, "title": path.stem.replace("_", " "), "status": "active", **by_file.get(rel, {})}
        if meta.get("ingest") is False:   # e.g. repealed acts kept only for the stop-list
            continue
        if rel not in by_file:
            print(f"  ! {rel} has no entry in meta.yaml (no number/url -> weaker citations)")
        text = read_file(path)
        if not text.strip():
            print(f"  ! empty: {rel}")
            continue
        try:
            _, n = await ingest_text(s, text, meta)
            await s.commit()   # one document per transaction: a bad file must not roll back the others
        except Exception as e:
            await s.rollback()
            print(f"  ! FAILED {rel}: {type(e).__name__}: {str(e).splitlines()[0][:200]}")
            continue
        results.append((rel, n))
        print(f"  + {rel}: {n} chunks", flush=True)
    return results


async def reindex(s: AsyncSession, doc: Document) -> int:
    """Re-chunk a document from its stored chunks' source file, or from its existing chunk text."""
    from app.config import DATA_DIR
    path = DATA_DIR / "documents" / (doc.file or "")
    if doc.file and path.exists():
        text = read_file(path)
        return await store_chunks(s, doc, chunk_document(text, doc.title))
    chunks = (await s.execute(select(Chunk).where(Chunk.document_id == doc.id).order_by(Chunk.id))).scalars().all()
    pieces = [Piece(c.article_ref, c.header, c.text) for c in chunks]
    return await store_chunks(s, doc, pieces)
