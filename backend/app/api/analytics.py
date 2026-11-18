"""Dashboard data: summary metrics and the FAQ report."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.analytics import faq_report
from app.api.auth import require
from app.db.models import Alert, Classification, Message, Staff, Ticket
from app.db.session import DB

router = APIRouter(prefix="/api", tags=["analytics"])
VIEW = require("manager", "operator", "specialist")
EXCLUDED = ("eval", "api", "virtual_reception")


def _pct(values: list[float], q: float) -> float | None:
    return round(float(np.percentile(values, q)), 1) if values else None


@router.get("/analytics/summary")
async def summary(from_: datetime | None = Query(None, alias="from"), to: datetime | None = None, staff: Staff = Depends(VIEW),
                  s: AsyncSession = DB):
    to = to or datetime.now(timezone.utc)
    from_ = from_ or to - timedelta(days=7)
    q = (select(Message).options(selectinload(Message.classification).selectinload(Classification.topic),
                                 selectinload(Message.responses))
         .where(Message.received_at >= from_, Message.received_at < to, Message.channel.not_in(EXCLUDED)))
    if staff.region:
        q = q.join(Classification).where(Classification.region == staff.region)
    msgs = (await s.execute(q)).scalars().all()

    levels, types, sentiment, regions, topics, channels = (Counter() for _ in range(6))
    per_day: dict[str, int] = defaultdict(int)
    green_latency, ratings = [], []
    for m in msgs:
        main = next((r for r in m.responses if r.kind != "holding" and r.kind != "specialist"), None)
        lvl = main.level if main else "pending"
        levels[lvl] += 1
        channels[m.channel] += 1
        per_day[m.received_at.date().isoformat()] += 1
        if main and main.level == "green" and main.latency_ms is not None:
            green_latency.append(main.latency_ms / 1000)
        ratings += [r.rating for r in m.responses if r.rating]
        c = m.classification
        if c:
            types[c.type] += 1
            sentiment[c.sentiment] += 1
            regions[c.region or "unknown"] += 1
            topics[c.topic.name_uz if c.topic else "boshqa"] += 1

    tq = select(Ticket).where(Ticket.created_at >= from_, Ticket.created_at < to)
    if staff.region:
        tq = tq.where(Ticket.region == staff.region)
    tickets = (await s.execute(tq)).scalars().all()
    now = datetime.now(timezone.utc)
    close_hours = [(t.answered_at - t.created_at).total_seconds() / 3600 for t in tickets if t.answered_at]
    answerable = sum(v for k, v in levels.items() if k != "none")
    alerts = (await s.execute(select(Alert).where(Alert.created_at >= from_, Alert.created_at < to))).scalars().all()

    return {
        "from": from_.isoformat(), "to": to.isoformat(),
        "total": len(msgs),
        "by_channel": dict(channels), "by_level": dict(levels), "by_type": dict(types),
        "sentiment": dict(sentiment), "by_region": dict(regions.most_common()),
        "top_topics": [{"topic": k, "count": v} for k, v in topics.most_common(10)],
        "per_day": [{"date": d, "count": per_day[d]} for d in sorted(per_day)],
        "auto_answer_rate": round(levels.get("green", 0) / answerable, 3) if answerable else None,
        "response_time_s": {"p50": _pct(green_latency, 50), "p95": _pct(green_latency, 95)},
        "tickets": {
            "created": len(tickets),
            "open": sum(t.status in ("open", "in_progress") for t in tickets),
            "overdue": sum(t.status in ("open", "in_progress") and now > t.due_at for t in tickets),
            "answered": sum(t.status in ("answered", "closed") for t in tickets),
            "avg_close_hours": round(sum(close_hours) / len(close_hours), 1) if close_hours else None,
        },
        "rating_avg": round(sum(ratings) / len(ratings), 2) if ratings else None,
        "alerts": dict(Counter(a.kind for a in alerts)),
    }


@router.get("/reports/faq")
async def get_faq(period: str = "week", staff: Staff = Depends(VIEW), s: AsyncSession = DB):
    r = await faq_report.latest(s, period)
    if not r:
        raise HTTPException(404, "no report yet: POST /api/reports/faq/run")
    return faq_report.serialize(r)


@router.post("/reports/faq/run")
async def run_faq(period: str = "week", from_: datetime | None = Query(None, alias="from"), to: datetime | None = None,
                  staff: Staff = Depends(require("manager", "operator")), s: AsyncSession = DB):
    """Rebuild the report now (the demo button). from_/to override the period window."""
    rid = await faq_report.run(period, end=to, start=from_)
    r = await faq_report.latest(s, period)
    return faq_report.serialize(r) if r and r.id == rid else {"report_id": rid}
