"""Real-time spike alerts: a topic got >= SPIKE_FACTOR x its usual hourly volume in the last hour."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.db.models import Alert, Classification, Message, Topic
from app.db.session import session_scope
from app.tickets import notify

SPIKE_FACTOR = float(os.getenv("SPIKE_FACTOR", "3"))
SPIKE_MIN_COUNT = int(os.getenv("SPIKE_MIN_COUNT", "5"))
COOLDOWN = timedelta(hours=6)


async def spike_check(now: datetime | None = None) -> list[str]:
    now = now or datetime.now(timezone.utc)
    hour_ago, week_ago = now - timedelta(hours=1), now - timedelta(days=7)
    fired = []
    async with session_scope() as s:
        def counts(a, b):
            return (select(Classification.topic_id, func.count()).join(Message)
                    .where(Message.received_at >= a, Message.received_at < b,
                           Classification.type.not_in(["spam", "insult"]))
                    .group_by(Classification.topic_id))
        recent = dict((await s.execute(counts(hour_ago, now))).all())
        baseline = dict((await s.execute(counts(week_ago, hour_ago))).all())
        hours = (hour_ago - week_ago).total_seconds() / 3600
        for topic_id, n in recent.items():
            avg = baseline.get(topic_id, 0) / hours
            if n < SPIKE_MIN_COUNT or n < SPIKE_FACTOR * max(avg, 0.5):
                continue
            last = (await s.execute(select(Alert).where(Alert.kind == "spike", Alert.topic_id == topic_id,
                                                        Alert.created_at > now - COOLDOWN))).scalar()
            if last:
                continue
            topic = await s.get(Topic, topic_id) if topic_id else None
            name = topic.name_uz if topic else "boshqa"
            text = f"Keskin o'sish: «{name}» mavzusida so'nggi soatda {n} ta xabar (o'rtacha {avg:.1f}/soat)."
            s.add(Alert(kind="spike", topic_id=topic_id, text=text, payload={"count": n, "avg": round(avg, 2)}))
            fired.append(text)
    for text in fired:
        await notify.alert(text)
    return fired
