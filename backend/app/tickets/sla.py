"""Deadlines, reminders and escalation (section 5, module 4).

Default terms come from TICKET_DUE_DAYS / TICKET_DUE_DAYS_HIGH. Check them against the
current edition of the Law "On appeals of individuals and legal entities" on lex.uz.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.config import TICKET_DUE_DAYS, TICKET_DUE_DAYS_HIGH
from app.db.models import Staff, Ticket, TicketEvent
from app.db.session import session_scope
from app.tickets import notify

log = logging.getLogger("sla")
OPEN = ("open", "in_progress")


def due_date(priority: str, start: datetime | None = None) -> datetime:
    start = start or datetime.now(timezone.utc)
    days = TICKET_DUE_DAYS_HIGH if priority == "high" else TICKET_DUE_DAYS
    return start + timedelta(days=days)


async def check_deadlines() -> dict:
    """Reminder at 80% of the term; escalation to managers when overdue. Each fires once per ticket."""
    now = datetime.now(timezone.utc)
    reminded = escalated = 0
    async with session_scope() as s:
        tickets = (await s.execute(select(Ticket).where(Ticket.status.in_(OPEN)))).scalars().all()
        for t in tickets:
            kinds = {e.type for e in (await s.execute(
                select(TicketEvent).where(TicketEvent.ticket_id == t.id))).scalars()}
            total = (t.due_at - t.created_at).total_seconds() or 1
            elapsed = (now - t.created_at).total_seconds()
            if now > t.due_at and not t.escalated:
                t.escalated = True
                s.add(TicketEvent(ticket_id=t.id, type="escalated", actor="system", payload={"due_at": t.due_at.isoformat()}))
                managers = (await s.execute(select(Staff).where(Staff.role == "manager"))).scalars().all()
                text = f"Muddati o'tgan murojaat {t.number}: {t.summary}"
                for m in managers:
                    await notify.alert(text, m.telegram_id)
                if not managers:
                    await notify.alert(text)
                escalated += 1
            elif elapsed / total >= 0.8 and "reminder" not in kinds and now <= t.due_at:
                s.add(TicketEvent(ticket_id=t.id, type="reminder", actor="system", payload={}))
                if t.assignee_id:
                    a = await s.get(Staff, t.assignee_id)
                    await notify.send_telegram(a.telegram_id if a else None,
                                               f"⏰ {t.number}: muddat {t.due_at:%d.%m.%Y}. {t.summary}")
                reminded += 1
    return {"reminded": reminded, "escalated": escalated}
