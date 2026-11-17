"""Operator panel: inbox of drafts, approve/reject/edit, tickets, virtual-reception drafts."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.adapters.base import deliver
from app.db.models import Alert, Classification, Department, Message, Response, Staff, Ticket, TicketEvent, Topic
from app.db.session import DB
from app.api.auth import require
from app.pipeline.inbound import Author, InboundMessage
from app.pipeline.process import handle
from app.tickets.service import answer_ticket, create_ticket

router = APIRouter(prefix="/api", tags=["panel"])
STAFF = require("operator", "specialist", "manager")


def _scope(q: Select, staff: Staff, ticket: bool) -> Select:
    """Regional staff see only their region; specialists only their department's tickets."""
    if staff.region:
        q = q.where((Ticket.region if ticket else Classification.region) == staff.region)
    if ticket and staff.role == "specialist" and staff.department_id:
        q = q.where(Ticket.department_id == staff.department_id)
    return q


def _msg(m: Message) -> dict:
    c = m.classification
    return {
        "id": m.id, "channel": m.channel, "text": m.text_masked, "lang": m.lang, "script": m.script,
        "is_public": m.is_public, "is_foreign_page": m.is_foreign_page, "received_at": m.received_at.isoformat(),
        "classification": None if c is None else {
            "type": c.type, "topic": c.topic.code if c.topic else None,
            "topic_name": c.topic.name_uz if c.topic else None, "region": c.region, "sentiment": c.sentiment,
            "urgency": c.urgency, "flags": c.flags},
    }


def _resp(r: Response) -> dict:
    return {"id": r.id, "level": r.level, "kind": r.kind, "status": r.status, "answer": r.answer_text,
            "citations": r.citations, "confidence": r.confidence, "reason": r.reason,
            "created_at": r.created_at.isoformat(), "message": _msg(r.message)}


# ------------------------------------------------------------------ inbox / drafts
@router.get("/inbox")
async def inbox(level: str | None = "yellow", status: str | None = "draft", limit: int = 100,
                staff: Staff = Depends(STAFF), s: AsyncSession = DB):
    q = (select(Response).join(Message).outerjoin(Classification)
         .options(selectinload(Response.message).selectinload(Message.classification)
                  .selectinload(Classification.topic))
         .where(Response.kind.in_(["ai", "template"])).order_by(Response.id.desc()).limit(limit))
    if level:
        q = q.where(Response.level == level)
    if status:
        q = q.where(Response.status == status)
    q = _scope(q, staff, ticket=False)
    return [_resp(r) for r in (await s.execute(q)).scalars().all()]


async def _get_resp(s: AsyncSession, rid: int) -> Response:
    r = (await s.execute(select(Response).where(Response.id == rid).options(
        selectinload(Response.message).selectinload(Message.classification).selectinload(Classification.topic))
    )).scalar()
    if not r:
        raise HTTPException(404, "response not found")
    return r


class ApproveIn(BaseModel):
    text: str | None = None   # optional final edit before sending


@router.post("/responses/{rid}/approve")
async def approve(rid: int, body: ApproveIn | None = None, staff: Staff = Depends(STAFF),
                  s: AsyncSession = DB):
    r = await _get_resp(s, rid)
    if r.status != "draft":
        raise HTTPException(409, f"response is {r.status}")
    if body and body.text:
        r.answer_text = body.text
    if not r.answer_text.strip():
        raise HTTPException(422, "empty answer, edit it first")
    r.status, r.approved_by, r.sent_at = "sent", staff.id, datetime.now(timezone.utc)
    delivered = await deliver(r.message, r.answer_text)
    s.add(TicketEvent(type="draft_approved", actor=staff.username, payload={"response_id": r.id, "delivered": delivered}))
    return {"ok": True, "delivered": delivered}


class RejectIn(BaseModel):
    reason: str = ""
    create_ticket: bool = True


@router.post("/responses/{rid}/reject")
async def reject(rid: int, body: RejectIn, staff: Staff = Depends(STAFF), s: AsyncSession = DB):
    r = await _get_resp(s, rid)
    r.status = "rejected"
    s.add(TicketEvent(type="draft_rejected", actor=staff.username, payload={"response_id": r.id, "reason": body.reason}))
    ticket = None
    if body.create_ticket:
        m = r.message
        c = m.classification
        ticket = await create_ticket(s, m, topic=c.topic if c else None, region=c.region if c else None,
                                     urgency=c.urgency if c else "normal", summary=m.text_masked[:200],
                                     draft_answer=r.answer_text, draft_citations=r.citations)
    return {"ok": True, "ticket_number": ticket.number if ticket else None}


class EditIn(BaseModel):
    text: str


@router.post("/responses/{rid}/edit")
async def edit(rid: int, body: EditIn, staff: Staff = Depends(STAFF), s: AsyncSession = DB):
    r = await _get_resp(s, rid)
    if r.status != "draft":
        raise HTTPException(409, f"response is {r.status}")
    r.answer_text = body.text
    s.add(TicketEvent(type="draft_edited", actor=staff.username, payload={"response_id": r.id}))
    return _resp(r)


# ------------------------------------------------------------------ tickets
def _ticket(t: Ticket, full: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    d = {"id": t.id, "number": t.number, "status": t.status, "priority": t.priority, "region": t.region,
         "department_id": t.department_id, "department": t.department.name if t.department else None,
         "assignee_id": t.assignee_id, "summary": t.summary, "due_at": t.due_at.isoformat(),
         "overdue": t.status in ("open", "in_progress") and now > t.due_at, "escalated": t.escalated,
         "rating": t.rating, "created_at": t.created_at.isoformat(), "channel": t.message.channel}
    if full:
        d |= {"message": _msg(t.message), "draft_answer": t.draft_answer, "draft_citations": t.draft_citations,
              "similar": t.similar, "final_answer": t.final_answer,
              "events": [{"type": e.type, "actor": e.actor, "payload": e.payload,
                          "created_at": e.created_at.isoformat()} for e in t.events]}
    return d


def _ticket_q():
    return select(Ticket).options(
        selectinload(Ticket.department), selectinload(Ticket.events),
        selectinload(Ticket.message).selectinload(Message.classification).selectinload(Classification.topic))


@router.get("/tickets")
async def tickets(status: str | None = None, department_id: int | None = None, overdue: bool | None = None,
                  limit: int = 200, staff: Staff = Depends(STAFF), s: AsyncSession = DB):
    q = _scope(_ticket_q().order_by(Ticket.id.desc()).limit(limit), staff, ticket=True)
    if status:
        q = q.where(Ticket.status == status)
    if department_id:
        q = q.where(Ticket.department_id == department_id)
    if overdue:
        q = q.where(Ticket.status.in_(["open", "in_progress"]), Ticket.due_at < datetime.now(timezone.utc))
    return [_ticket(t) for t in (await s.execute(q)).scalars().all()]


async def _get_ticket(s: AsyncSession, tid: int) -> Ticket:
    t = (await s.execute(_ticket_q().where(Ticket.id == tid))).scalar()
    if not t:
        raise HTTPException(404, "ticket not found")
    return t


@router.get("/tickets/{tid}")
async def ticket(tid: int, staff: Staff = Depends(STAFF), s: AsyncSession = DB):
    return _ticket(await _get_ticket(s, tid), full=True)


class TicketPatch(BaseModel):
    status: str | None = Field(None, pattern="^(open|in_progress|answered|closed)$")
    assignee_id: int | None = None
    department_id: int | None = None
    priority: str | None = Field(None, pattern="^(low|normal|high)$")


@router.patch("/tickets/{tid}")
async def patch_ticket(tid: int, body: TicketPatch, staff: Staff = Depends(STAFF),
                       s: AsyncSession = DB):
    t = await _get_ticket(s, tid)
    changes = body.model_dump(exclude_none=True)
    for k, v in changes.items():
        setattr(t, k, v)
    s.add(TicketEvent(ticket_id=t.id, type="updated", actor=staff.username, payload=changes))
    await s.flush()
    return _ticket(await _get_ticket(s, tid), full=True)


class TicketAnswerIn(BaseModel):
    text: str = Field(min_length=1)
    add_to_kb: bool = False


@router.post("/tickets/{tid}/answer")
async def ticket_answer(tid: int, body: TicketAnswerIn, staff: Staff = Depends(STAFF),
                        s: AsyncSession = DB):
    t = await _get_ticket(s, tid)
    if t.status in ("answered", "closed"):
        raise HTTPException(409, f"ticket is {t.status}")
    await answer_ticket(s, t, body.text, staff, body.add_to_kb)
    return {"ok": True, "number": t.number}


# ------------------------------------------------------------------ virtual reception + reference data
class DraftIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


@router.post("/panel/draft")
async def virtual_reception_draft(body: DraftIn, staff: Staff = Depends(STAFF)):
    """Staff pastes an appeal from the Virtual Reception -> draft answer with citations (never sent)."""
    r = await handle(InboundMessage(channel="virtual_reception", author=Author(external_id=f"staff:{staff.id}"),
                                    text=body.text), send=False)
    return {"draft": r["draft"] or r["answer"], "citations": r["draft_citations"] or r["citations"],
            "confidence": r["confidence"], "classification": r["classification"], "response_id": r["response_id"],
            "all_citations": r["debug"]["retrieval"]}


@router.get("/staff")
async def staff_list(staff: Staff = Depends(STAFF), s: AsyncSession = DB):
    rows = (await s.execute(select(Staff).where(Staff.is_active))).scalars().all()
    return [{"id": x.id, "username": x.username, "full_name": x.full_name, "role": x.role,
             "department_id": x.department_id, "region": x.region} for x in rows]


@router.get("/departments")
async def departments(s: AsyncSession = DB):
    return [{"id": d.id, "code": d.code, "name": d.name} for d in (await s.execute(select(Department))).scalars()]


@router.get("/topics")
async def topics(s: AsyncSession = DB):
    return [{"id": t.id, "code": t.code, "name_uz": t.name_uz, "name_ru": t.name_ru, "department_id": t.department_id}
            for t in (await s.execute(select(Topic))).scalars()]


@router.get("/alerts")
async def alerts(limit: int = 50, staff: Staff = Depends(STAFF), s: AsyncSession = DB):
    rows = (await s.execute(select(Alert).order_by(Alert.id.desc()).limit(limit))).scalars().all()
    return [{"id": a.id, "kind": a.kind, "text": a.text, "payload": a.payload, "created_at": a.created_at.isoformat()}
            for a in rows]
