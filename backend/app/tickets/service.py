"""Ticket lifecycle: create -> (assign) -> specialist answer -> delivered to the original channel
-> rating; optional add_to_kb turns the answer into a knowledge-base FAQ entry."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import deliver
from app.config import TICKET_PREFIX
from app.db.models import Classification, Message, Response, Staff, Ticket, TicketEvent, Topic
from app.kb.ingest import ingest_text
from app.tickets.sla import due_date


async def create_ticket(s: AsyncSession, msg: Message, *, topic: Topic | None, region: str | None, urgency: str,
                        summary: str, draft_answer: str | None, draft_citations: list) -> Ticket:
    priority = urgency if urgency in {"low", "normal", "high"} else "normal"
    similar = []
    if topic:
        rows = (await s.execute(
            select(Ticket).join(Classification, Classification.message_id == Ticket.message_id)
            .where(Classification.topic_id == topic.id, Ticket.final_answer.is_not(None))
            .order_by(Ticket.answered_at.desc()).limit(3)
        )).scalars().all()
        similar = [{"number": t.number, "summary": t.summary, "final_answer": t.final_answer} for t in rows]
    t = Ticket(
        number=f"tmp-{uuid.uuid4().hex[:16]}", message_id=msg.id, department_id=topic.department_id if topic else None,
        region=region, priority=priority, status="open", due_at=due_date(priority),
        summary=summary or msg.text_masked[:200], draft_answer=draft_answer, draft_citations=draft_citations,
        similar=similar,
    )
    s.add(t)
    await s.flush()
    t.number = f"{TICKET_PREFIX}-{datetime.now(timezone.utc):%Y}-{t.id:06d}"
    s.add(TicketEvent(ticket_id=t.id, type="created", actor="system",
                      payload={"department_id": t.department_id, "priority": priority}))
    return t


async def answer_ticket(s: AsyncSession, t: Ticket, text: str, staff: Staff, add_to_kb: bool) -> Response:
    msg = await s.get(Message, t.message_id)
    t.final_answer = text
    t.status = "answered"
    t.answered_at = datetime.now(timezone.utc)
    resp = Response(message_id=msg.id, level="red", kind="specialist", answer_text=text,
                    citations=t.draft_citations or [], confidence=1.0, status="sent", approved_by=staff.id,
                    sent_at=t.answered_at, reason=f"specialist answer to {t.number}")
    s.add(resp)
    delivered = await deliver(msg, f"№{t.number}: {text}" if msg.channel != "web" else text)
    s.add(TicketEvent(ticket_id=t.id, type="answered", actor=staff.username,
                      payload={"delivered": delivered, "add_to_kb": add_to_kb}))
    if add_to_kb:
        basis = "; ".join(f'{c["title"]}, {c["ref"]}' for c in (t.draft_citations or []))
        doc, _ = await ingest_text(s, f"S: {msg.text_masked}\nJ: {text}" + (f"\nAsos: {basis}" if basis else ""), {
            "title": f"Mutaxassis javobi {t.number}", "doc_type": "specialist_answer", "status": "active",
            "source_url": (t.draft_citations or [{}])[0].get("url") if t.draft_citations else None,
        })
        s.add(TicketEvent(ticket_id=t.id, type="added_to_kb", actor=staff.username, payload={"document_id": doc.id}))
    return resp
