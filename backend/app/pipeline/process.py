"""One inquiry, start to finish (section 7, steps 1-8). Every channel calls handle()."""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import deliver
from app.pipeline.templates import format_sources
from app.db.models import Alert, Citizen, Classification, Message, Response, Ticket, Topic
from app.db.session import session_scope
from app.pipeline import templates
from app.pipeline.answer import AnswerResult, generate
from app.pipeline.classify import ClassificationResult, classify
from app.pipeline.inbound import InboundMessage
from app.pipeline.normalize import normalize
from app.pipeline.retrieve import Hit, retrieve, semantic_text
from app.pipeline.route import decide
from app.tickets import notify
from app.tickets.service import create_ticket

log = logging.getLogger("pipeline")
PRIVATE_PUSH = {"telegram_dm", "instagram_dm", "telegram_group"}   # "being prepared" note on yellow


async def _citizen(s: AsyncSession, inb: InboundMessage, lang: str, phone_hash: str | None) -> Citizen:
    # Atomic get-or-create: two messages from one person processed at once must not both INSERT.
    channel = inb.channel.split("_")[0]
    await s.execute(pg_insert(Citizen).values(
        channel=channel, external_id=inb.author.external_id, display=inb.author.display, lang_pref=lang,
    ).on_conflict_do_nothing(index_elements=["channel", "external_id"]))
    c = (await s.execute(select(Citizen).where(
        Citizen.channel == channel, Citizen.external_id == inb.author.external_id))).scalar_one()
    if phone_hash:
        c.phone_hash = phone_hash
    await s.flush()
    return c


async def _retrieve_and_answer(text_masked: str, text_latin: str, lang: str, script: str,
                               is_public: bool) -> tuple[list[Hit], AnswerResult]:
    async with session_scope() as s:
        hits = await retrieve(s, text_latin, semantic=semantic_text(text_masked, text_latin, lang))
    return hits, await generate(text_masked, hits, lang, script, is_public)


async def handle(inb: InboundMessage, *, send: bool = True) -> dict:
    """Process one inbound message. send=False: compute and store, but deliver nothing (eval, drafts)."""
    t0 = time.perf_counter()
    norm = normalize(inb.text)

    # Steps 3-5 in parallel: classification || (search -> answer). Saves one LLM round-trip.
    cls_task = classify(norm.text_masked, inb.channel, inb.is_public)
    ra_task = _retrieve_and_answer(norm.text_masked, norm.text_latin, norm.lang, norm.script, inb.is_public)
    cls, (hits, ans) = await asyncio.gather(cls_task, ra_task)
    cls: ClassificationResult

    if inb.channel == "virtual_reception":   # staff paste: always a draft, never sent
        decision = decide(cls, ans, is_public=False, is_foreign_page=False)
        decision.level, decision.action = "yellow", "draft"
    else:
        decision = decide(cls, ans, is_public=inb.is_public, is_foreign_page=inb.is_foreign_page)

    async with session_scope() as s:
        citizen = await _citizen(s, inb, norm.lang, norm.phone_hash)
        msg = Message(
            citizen_id=citizen.id, channel=inb.channel, external_msg_id=inb.external_id, thread_ref=inb.thread_ref,
            text_raw=norm.text_raw, text_masked=norm.text_masked, text_latin=norm.text_latin, lang=norm.lang,
            script=norm.script, is_public=inb.is_public, is_mention=inb.is_mention,
            is_foreign_page=inb.is_foreign_page, reply_ctx=inb.reply_ctx, received_at=inb.received_at,
        )
        s.add(msg)
        await s.flush()

        topic = (await s.execute(select(Topic).where(Topic.code == cls.topic))).scalar()
        s.add(Classification(message_id=msg.id, type=cls.type, topic_id=topic.id if topic else None,
                             region=cls.region, sentiment=cls.sentiment, urgency=cls.urgency, flags=cls.flags,
                             model=cls.model))

        # ---- what the citizen gets now
        reply_text = ""
        kind = "ai"
        ticket: Ticket | None = None
        if decision.action == "answer":
            reply_text = ans.answer
            if ans.citations and inb.channel not in {"web", "api", "eval"}:   # web shows citations itself
                reply_text += "\n\n" + format_sources(ans.citations, norm.lang, norm.script)
        elif decision.action == "template":
            kind = "template"
            reply_text = templates.render(decision.template, norm.lang, norm.script)
        elif decision.action == "ticket":
            urgency = "high" if decision.alert else cls.urgency
            ticket = await create_ticket(
                s, msg, topic=topic, region=cls.region, urgency=urgency, summary=cls.summary_uz,
                draft_answer=ans.answer or None, draft_citations=ans.citations)
            kind = "template"
            if decision.template:                      # fraud / violence warning
                reply_text = templates.render(decision.template, norm.lang, norm.script)
            else:
                notice = templates.render("ticket_public" if inb.is_public else "ticket", norm.lang, norm.script,
                                          number=ticket.number, due=ticket.due_at)
                # Explain the general rule first when it is backed by a valid citation (not in public).
                general = ans.answer if (ans.citations and not inb.is_public and not ans.failed) else ""
                reply_text = f"{general}\n\n{notice}".strip()
                kind = "ai" if general else "template"
        elif decision.action == "draft" and inb.channel in PRIVATE_PUSH:
            kind = "holding"
            reply_text = templates.render("holding", norm.lang, norm.script)

        latency_ms = int((time.perf_counter() - t0) * 1000)
        debug = {
            "retrieval": [{"chunk_id": h.chunk_id, "ref": h.article_ref, "title": h.title, "number": h.number,
                           "document_id": h.document_id, "score": round(h.score, 3),
                           "vec_sim": round(h.vec_sim, 3), "support": round(h.support, 3), "rrf": round(h.rrf, 4)} for h in hits],
            "llm_confidence": ans.llm_confidence, "invalid_citations": ans.invalid_citations,
            "classification": cls.__dict__, "lang": norm.lang, "script": norm.script,
            "pii_masked": sum(len(v) for v in norm.pii.values()),
        }
        # The AI answer is always stored (drafts are what operators approve). For yellow it is the draft.
        resp = Response(
            message_id=msg.id, level=decision.level, kind=kind,
            answer_text=ans.answer if decision.action == "draft" else reply_text,
            citations=ans.citations, confidence=ans.confidence, reason=decision.reason,
            status={"answer": "sent", "template": "sent", "ticket": "sent", "draft": "draft", "ignore": "skipped"}[
                decision.action],
            latency_ms=latency_ms, debug=debug,
        )
        if decision.action in {"answer", "template", "ticket"}:
            resp.sent_at = datetime.now(timezone.utc)
        s.add(resp)
        if decision.action == "draft" and kind == "holding":
            s.add(Response(message_id=msg.id, level="yellow", kind="holding", answer_text=reply_text,
                           status="sent", sent_at=datetime.now(timezone.utc), reason="holding note"))

        if decision.alert:
            s.add(Alert(kind=decision.alert, topic_id=topic.id if topic else None, message_id=msg.id,
                        text=norm.text_masked[:500], payload={"ticket": ticket.number if ticket else None,
                                                             "channel": inb.channel}))
        await s.flush()
        result = {
            "message_id": msg.id,
            "response_id": resp.id,
            "level": decision.level,
            "action": decision.action,
            "answer": "" if decision.action in {"draft", "ignore"} and kind != "holding" else reply_text,
            "citations": ans.citations if decision.action in {"answer", "ticket"} and kind == "ai" else [],
            "confidence": ans.confidence,
            "ticket_number": ticket.number if ticket else None,
            "due_at": ticket.due_at.isoformat() if ticket else None,
            "reason": decision.reason,
            "latency_ms": latency_ms,
            "lang": norm.lang,
            "script": norm.script,
            "classification": {"type": cls.type, "topic": cls.topic, "region": cls.region, "flags": cls.flags,
                               "sentiment": cls.sentiment, "urgency": cls.urgency},
            "draft": ans.answer if decision.action == "draft" else None,
            "draft_citations": ans.citations if decision.action == "draft" else [],
            "debug": debug,
        }

    # ---- after commit: deliver + alerts (never block the DB transaction on network)
    if send and reply_text:
        await deliver(msg, reply_text)
    if decision.alert:
        await notify.alert(f"{decision.alert.upper()} [{inb.channel}] {norm.text_masked[:300]}"
                           + (f"\nTicket: {ticket.number}" if ticket else ""))
    return result
