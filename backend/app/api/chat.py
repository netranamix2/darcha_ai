"""Website chat (public, no login, rate-limited) + /api/ask for tests and run_eval.py."""
from __future__ import annotations

import asyncio
import time
import uuid
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import CHAT_RATE_LIMIT_PER_MIN, ENABLE_VOICE
from app.db.models import Message, Response, Ticket
from app.db.session import DB
from app.pipeline.inbound import Author, InboundMessage
from app.pipeline.process import handle

router = APIRouter(tags=["chat"])

_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "?"
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= CHAT_RATE_LIMIT_PER_MIN:
        raise HTTPException(429, "too many requests, try again in a minute")
    q.append(now)


class Citation(BaseModel):
    title: str
    ref: str
    url: str | None = None


class ChatReply(BaseModel):
    message_id: int
    answer: str
    citations: list[Citation]
    level: str = Field(description="green = AI answer; none = not answered (spam/abuse, answer is empty); "
                                   "yellow = staff is preparing the answer (answer is empty); "
                                   "red = ticket created (ticket_number, due_at)")
    ticket_number: str | None = None
    due_at: str | None = None


class ChatIn(BaseModel):
    session_id: str
    text: str = Field(min_length=1, max_length=4000)


def _public(result: dict) -> ChatReply:
    return ChatReply(
        message_id=result["message_id"], answer=result["answer"],
        citations=[Citation(title=c["title"], ref=c["ref"], url=c.get("url")) for c in result["citations"]],
        level=result["level"],
        ticket_number=result["ticket_number"], due_at=result["due_at"],
    )


@router.post("/api/chat/sessions")
async def new_session():
    return {"session_id": uuid.uuid4().hex}


@router.post("/api/chat/messages", response_model=ChatReply, dependencies=[Depends(rate_limit)])
async def chat_message(body: ChatIn):
    result = await handle(InboundMessage(
        channel="web", thread_ref=body.session_id, author=Author(external_id=body.session_id), text=body.text))
    return _public(result)


@router.get("/api/chat/sessions/{session_id}/messages")
async def chat_history(session_id: str, s: AsyncSession = DB):
    """Poll every 5-10 s: specialist answers to tickets and approved drafts appear here."""
    msgs = (await s.execute(
        select(Message).where(Message.channel == "web", Message.thread_ref == session_id).order_by(Message.id)
    )).scalars().all()
    if not msgs:
        return []
    ids = [m.id for m in msgs]
    resps = (await s.execute(select(Response).where(Response.message_id.in_(ids), Response.status == "sent")
                             .order_by(Response.id))).scalars().all()
    tickets = {t.message_id: t for t in (await s.execute(select(Ticket).where(Ticket.message_id.in_(ids)))).scalars()}
    by_msg: dict[int, list[Response]] = defaultdict(list)
    for r in resps:
        by_msg[r.message_id].append(r)
    out = []
    for m in msgs:
        out.append({"id": f"m{m.id}", "role": "user", "text": m.text_raw, "created_at": m.received_at.isoformat()})
        t = tickets.get(m.id)
        pending = not by_msg[m.id]
        for r in by_msg[m.id]:
            out.append({
                "id": f"r{r.id}", "role": "specialist" if r.kind == "specialist" else "bot", "text": r.answer_text,
                "citations": [{"title": c["title"], "ref": c["ref"], "url": c.get("url")} for c in r.citations or []]
                if r.kind != "template" else [],
                "level": r.level, "ticket_number": t.number if t else None,
                "due_at": t.due_at.isoformat() if t else None, "created_at": r.created_at.isoformat(),
            })
        if pending:
            out.append({"id": f"p{m.id}", "role": "bot", "text": "", "level": "yellow", "pending": True,
                        "citations": [], "created_at": m.received_at.isoformat()})
    return out


class RatingIn(BaseModel):
    rating: int = Field(ge=1, le=5)


@router.post("/api/chat/messages/{message_id}/rating")
async def rate(message_id: int, body: RatingIn, s: AsyncSession = DB):
    r = (await s.execute(select(Response).where(Response.message_id == message_id, Response.status == "sent")
                         .order_by(Response.id.desc()))).scalar()
    if not r:
        raise HTTPException(404, "no answer to rate")
    r.rating = body.rating
    t = (await s.execute(select(Ticket).where(Ticket.message_id == message_id))).scalar()
    if t:
        t.rating = body.rating
    return {"ok": True}


@router.post("/api/chat/voice", response_model=ChatReply, dependencies=[Depends(rate_limit)])
async def chat_voice(session_id: str = Form(...), audio: UploadFile = File(...)):
    if not ENABLE_VOICE:
        raise HTTPException(501, "voice is disabled (ENABLE_VOICE=0)")
    from app.adapters import voice
    transcript = await asyncio.to_thread(voice.transcribe, await audio.read())
    if not transcript:
        raise HTTPException(422, "could not recognise speech")
    result = await handle(InboundMessage(
        channel="web", thread_ref=session_id, author=Author(external_id=session_id), text=transcript))
    reply = _public(result).model_dump()
    return {**reply, "transcript": transcript}


class AskIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    channel: str = "api"


@router.post("/api/ask")
async def ask(body: AskIn):
    """Question -> answer with citations and level, plus debug info (retrieval scores, classification).
    Nothing is delivered anywhere."""
    if body.channel not in {"api", "eval"}:
        raise HTTPException(400, "channel must be api or eval")
    return await handle(InboundMessage(channel=body.channel, author=Author(external_id="api"), text=body.text),
                        send=False)
