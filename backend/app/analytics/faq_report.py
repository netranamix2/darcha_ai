"""FAQ report (section 10): what people ask, what they don't understand, ready clarification drafts.

messages for the period -> embeddings -> HDBSCAN clusters -> LLM names each cluster and says what is unclear
-> code counts size / regions / sentiment / escalations -> compare with the previous report
-> clarification drafts (post, FAQ card, bot template) for the top topics, from the knowledge base.
"""
from __future__ import annotations

import asyncio
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Classification, Cluster, Message, Report
from app.db.session import session_scope
from app.kb import embed
from app.llm.client import LLMError, complete_json
from app.pipeline.answer import format_sources
from app.pipeline.retrieve import retrieve, semantic_text
from app.tickets import notify

log = logging.getLogger("faq_report")
EXCLUDED_CHANNELS = ("eval", "api", "virtual_reception")
MAX_CLUSTERS = 12
EXPLAINERS_FOR_TOP = 5

CLUSTER_SCHEMA = {
    "type": "object",
    "properties": {"label_uz": {"type": "string"}, "label_ru": {"type": "string"},
                   "what_is_unclear": {"type": "string"}, "answered_in_kb": {"type": "boolean"}},
    "required": ["label_uz", "label_ru", "what_is_unclear", "answered_in_kb"],
    "additionalProperties": False,
}
EXPLAINER_SCHEMA = {
    "type": "object",
    "properties": {
        "post": {"type": "string"}, "faq_card": {"type": "string"}, "bot_template": {"type": "string"},
        "citations": {"type": "array", "items": {
            "type": "object", "properties": {"chunk_id": {"type": "string"}, "ref": {"type": "string"}},
            "required": ["chunk_id", "ref"], "additionalProperties": False}},
    },
    "required": ["post", "faq_card", "bot_template", "citations"],
    "additionalProperties": False,
}


def period_bounds(period: str, end: datetime | None = None) -> tuple[datetime, datetime]:
    end = end or datetime.now(timezone.utc)
    return end - timedelta(days=30 if period == "month" else 7), end


def cluster_vectors(vecs: np.ndarray, topics: list[str]) -> np.ndarray:
    """HDBSCAN on normalised vectors; falls back to grouping by topic when data is small or all noise."""
    n = len(vecs)
    labels = np.full(n, -1)
    if n >= 15:
        from sklearn.cluster import HDBSCAN
        labels = HDBSCAN(min_cluster_size=max(3, n // 40), min_samples=2).fit_predict(vecs)
    if (labels >= 0).sum() < n * 0.3:      # mostly noise -> use the classifier's topic as the group
        codes = {t: i for i, t in enumerate(sorted(set(topics)))}
        labels = np.array([codes[t] for t in topics])
    return labels


async def _ensure_embeddings(s: AsyncSession, msgs: list[Message]) -> None:
    missing = [m for m in msgs if m.embedding is None]
    if missing:
        vecs = await asyncio.to_thread(embed.embed, [semantic_text(m.text_masked, m.text_latin, m.lang) for m in missing])
        for m, v in zip(missing, vecs):
            m.embedding = v.tolist()
        await s.flush()


async def run(period: str = "week", end: datetime | None = None, start: datetime | None = None) -> int:
    p_from, p_to = period_bounds(period, end)
    if start:
        p_from = start
    async with session_scope() as s:
        msgs = (await s.execute(
            select(Message).join(Classification)
            .options(selectinload(Message.classification).selectinload(Classification.topic),
                     selectinload(Message.responses))
            .where(Message.received_at >= p_from, Message.received_at < p_to,
                   Message.channel.not_in(EXCLUDED_CHANNELS), Classification.type.not_in(["spam", "insult"]))
        )).scalars().all()
        report = Report(period=period, period_from=p_from, period_to=p_to, summary={})
        s.add(report)
        await s.flush()
        if not msgs:
            report.summary = {"messages": 0}
            return report.id

        await _ensure_embeddings(s, msgs)
        vecs = np.array([m.embedding for m in msgs], dtype=np.float32)
        topics = [m.classification.topic.code if m.classification.topic else "other" for m in msgs]
        labels = cluster_vectors(vecs, topics)

        groups = [(lab, np.where(labels == lab)[0]) for lab in set(labels.tolist()) if lab >= 0]
        groups.sort(key=lambda g: len(g[1]), reverse=True)
        groups = groups[:MAX_CLUSTERS]

        prev = (await s.execute(
            select(Report).options(selectinload(Report.clusters))
            .where(Report.period == period, Report.id != report.id, Report.period_to <= p_from + timedelta(days=1))
            .order_by(Report.period_to.desc()).limit(1))).scalar()
        prev_clusters = [(np.array(c.centroid, dtype=np.float32), c.size, c.label) for c in (prev.clusters if prev else [])]

        sem = asyncio.Semaphore(4)

        async def describe(lab: int, idx: np.ndarray, rank: int) -> Cluster:
            members = [msgs[i] for i in idx]
            centroid = vecs[idx].mean(axis=0)
            centroid /= np.linalg.norm(centroid) or 1
            order = np.argsort(-(vecs[idx] @ centroid))
            examples = [members[i].text_masked for i in order[:8]]
            async with session_scope() as s2:
                rep = members[order[0]]
                hits = await retrieve(s2, rep.text_latin, semantic=semantic_text(rep.text_masked, rep.text_latin, rep.lang))
            sources = format_sources(hits)
            async with sem:
                try:
                    info = await complete_json("cluster", CLUSTER_SCHEMA, max_tokens=1500, n=len(members),
                                               examples="\n".join(f"- {e}" for e in examples), sources=sources)
                except LLMError:
                    info = {"label_uz": topics[idx[0]], "label_ru": topics[idx[0]], "what_is_unclear": "",
                            "answered_in_kb": bool(hits)}
                explainer = {}
                if rank < EXPLAINERS_FOR_TOP and hits:
                    try:
                        explainer = await complete_json("explainer", EXPLAINER_SCHEMA, max_tokens=3000,
                                                        label=info["label_uz"], unclear=info["what_is_unclear"],
                                                        sources=sources)
                        by_id = {str(h.chunk_id): h for h in hits}
                        explainer["citations"] = [by_id[c["chunk_id"]].citation() for c in explainer["citations"]
                                                  if c["chunk_id"] in by_id]
                    except LLMError:
                        explainer = {}

            escalated = sum(1 for m in members if any(r.level in ("yellow", "red") and r.kind != "holding"
                                                      for r in m.responses))
            trend = {"status": "new", "prev": 0}
            if prev_clusters:
                sims = [(float(pc @ centroid), size) for pc, size, _ in prev_clusters]
                best, prev_size = max(sims)
                if best >= 0.85:
                    change = (len(members) - prev_size) / max(prev_size, 1)
                    trend = {"status": "growing" if change > 0.2 else "falling" if change < -0.2 else "stable",
                             "prev": prev_size, "change": round(change, 2)}
            return Cluster(
                report_id=report.id, cluster_id=int(lab), label=info["label_uz"],
                what_is_unclear=info["what_is_unclear"], size=len(members),
                regions=dict(Counter(m.classification.region or "unknown" for m in members).most_common()),
                sentiment=dict(Counter(m.classification.sentiment for m in members)),
                escalated_share=round(escalated / len(members), 2), unanswered_in_kb=not info["answered_in_kb"],
                trend=trend | {"label_ru": info["label_ru"]}, examples=examples[:5], explainer_draft=explainer,
                centroid=centroid.tolist(),
            )

        clusters = await asyncio.gather(*(describe(lab, idx, i) for i, (lab, idx) in enumerate(groups)))
        s.add_all(clusters)

        regions = Counter(m.classification.region or "unknown" for m in msgs)
        sentiments = Counter(m.classification.sentiment for m in msgs)
        report.summary = {
            "messages": len(msgs),
            "clusters": len(clusters),
            "new_topics": sum(1 for c in clusters if c.trend.get("status") == "new" and prev_clusters),
            "unanswered_in_kb": sum(1 for c in clusters if c.unanswered_in_kb),
            "negative_share": round(sentiments.get("negative", 0) / len(msgs), 2),
            "regions": dict(regions.most_common()),
            "channels": dict(Counter(m.channel for m in msgs)),
        }
        report_id = report.id
        top = clusters[:5]

    lines = [f"📊 FAQ hisobot ({p_from:%d.%m}–{p_to:%d.%m}): {len(msgs)} murojaat"]
    lines += [f"{i + 1}. {c.label} — {c.size} ta" + (" 🆕" if c.trend.get("status") == "new" and prev_clusters else "")
              for i, c in enumerate(top)]
    await notify.send_telegram(None, "\n".join(lines))
    return report_id


def serialize(report: Report) -> dict:
    return {
        "id": report.id, "period": report.period, "from": report.period_from.isoformat(),
        "to": report.period_to.isoformat(), "created_at": report.created_at.isoformat(), "summary": report.summary,
        "clusters": [{
            "id": c.id, "label": c.label, "label_ru": c.trend.get("label_ru"), "what_is_unclear": c.what_is_unclear,
            "size": c.size, "regions": c.regions, "sentiment": c.sentiment, "escalated_share": c.escalated_share,
            "unanswered_in_kb": c.unanswered_in_kb,
            "trend": {k: v for k, v in c.trend.items() if k != "label_ru"},
            "examples": c.examples, "explainer_draft": c.explainer_draft,
        } for c in report.clusters],
    }


async def latest(s: AsyncSession, period: str) -> Report | None:
    return (await s.execute(select(Report).options(selectinload(Report.clusters))
                            .where(Report.period == period).order_by(Report.id.desc()).limit(1))).scalar()


async def needs_weekly(s: AsyncSession) -> bool:
    r = await latest(s, "week")
    return r is None or r.created_at < datetime.now(timezone.utc) - timedelta(days=7)

