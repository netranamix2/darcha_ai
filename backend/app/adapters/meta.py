"""Instagram adapter (Meta Graph API) + a local simulator of a mock profile for the demo.

Real mode: a professional Instagram account + a Meta app in development mode, webhooks subscribed to
`comments`, `mentions` and `messages`. Endpoints and field names follow Meta's Instagram Graph API;
check them against the current Meta docs when connecting (versions change).

Simulator: /api/dev/instagram/* stores posts/comments/DMs in `demo_social` and runs them through the same
pipeline, so the demo works even if the Meta app is not approved in time. The mock profile is clearly
labelled "Darcha Demo" and does not use the ministry's name or emblem.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import register
from app.config import (ENABLE_SIMULATOR, META_ACCESS_TOKEN, META_APP_SECRET, META_GRAPH_URL, META_IG_USER_ID,
                        META_VERIFY_TOKEN)
from app.db.models import DemoSocial, Message
from app.db.session import get_session, session_scope
from app.pipeline.inbound import Author, InboundMessage
from app.pipeline.process import handle

log = logging.getLogger("meta")
api = APIRouter(tags=["webhooks"])
dev = APIRouter(prefix="/api/dev/instagram", tags=["instagram simulator"])
_tasks: set[asyncio.Task] = set()
DEMO_PROFILE = "darcha.demo"


def _spawn(coro) -> None:
    t = asyncio.create_task(coro)
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)


# ================================================================== real Meta webhooks
def verify_signature(body: bytes, header: str | None) -> bool:
    if not META_APP_SECRET:
        return False
    expected = "sha256=" + hmac.new(META_APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return bool(header) and hmac.compare_digest(expected, header)


@api.get("/webhooks/meta")
async def meta_verify(mode: str = Query(alias="hub.mode"), token: str = Query(alias="hub.verify_token"),
                      challenge: str = Query(alias="hub.challenge")):
    if mode == "subscribe" and META_VERIFY_TOKEN and token == META_VERIFY_TOKEN:
        return PlainTextResponse(challenge)
    raise HTTPException(403, "verification failed")


async def _graph(method: str, path: str, **kw) -> dict:
    async with httpx.AsyncClient(base_url=META_GRAPH_URL, timeout=20) as c:
        kw.setdefault("params", {})["access_token"] = META_ACCESS_TOKEN
        r = await c.request(method, path, **kw)
        r.raise_for_status()
        return r.json()


async def _from_mention(value: dict) -> InboundMessage | None:
    """A @mention of our account in a comment under someone else's post: fetch the comment text."""
    cid, media_id = value.get("comment_id"), value.get("media_id")
    if not cid:
        return None
    data = await _graph("GET", f"/{META_IG_USER_ID}", params={
        "fields": f"mentioned_comment.comment_id({cid}){{text,username,timestamp}}"})
    mc = data.get("mentioned_comment") or {}
    return InboundMessage(
        channel="instagram_mention", external_id=cid, thread_ref=f"ig:{media_id}",
        author=Author(external_id=mc.get("username", "unknown"), display=mc.get("username")),
        text=mc.get("text", ""), is_public=True, is_mention=True, is_foreign_page=True,
        reply_ctx={"kind": "mention", "comment_id": cid, "media_id": media_id},
    )


def parse_events(payload: dict) -> list[InboundMessage | dict]:
    """Meta payload -> InboundMessages (mentions are returned as raw dicts to be fetched asynchronously)."""
    out: list = []
    for entry in payload.get("entry", []):
        for ch in entry.get("changes", []):
            v = ch.get("value", {})
            if ch.get("field") == "comments":
                frm = v.get("from", {})
                if frm.get("id") == META_IG_USER_ID:
                    continue   # our own reply
                out.append(InboundMessage(
                    channel="instagram_comment", external_id=v.get("id"), thread_ref=f"ig:{v.get('media', {}).get('id')}",
                    author=Author(external_id=frm.get("id", "?"), display=frm.get("username")),
                    text=v.get("text", ""), is_public=True, reply_ctx={"kind": "comment", "comment_id": v.get("id")},
                ))
            elif ch.get("field") == "mentions":
                out.append({"mention": v})
        for ev in entry.get("messaging", []):
            msg = ev.get("message") or {}
            if msg.get("is_echo") or not msg.get("text"):
                continue
            sender = ev.get("sender", {}).get("id")
            out.append(InboundMessage(
                channel="instagram_dm", external_id=msg.get("mid"), thread_ref=f"igdm:{sender}",
                author=Author(external_id=sender or "?"), text=msg["text"], is_public=False,
                reply_ctx={"kind": "dm", "recipient_id": sender},
            ))
    return out


async def _run(item) -> None:
    try:
        inb = await _from_mention(item["mention"]) if isinstance(item, dict) else item
        if inb and inb.text.strip():
            await handle(inb)
    except Exception:
        log.exception("instagram event failed")


@api.post("/webhooks/meta")
async def meta_webhook(request: Request):
    body = await request.body()
    if not verify_signature(body, request.headers.get("X-Hub-Signature-256")):
        raise HTTPException(403, "bad signature")
    for item in parse_events(await request.json()):
        _spawn(_run(item))      # Meta expects a fast 200
    return {"ok": True}


async def send_real(msg: Message, text: str) -> None:
    ctx = msg.reply_ctx or {}
    kind = ctx.get("kind")
    if kind == "comment":
        await _graph("POST", f"/{ctx['comment_id']}/replies", params={"message": text[:2200]})
    elif kind == "mention":
        await _graph("POST", f"/{META_IG_USER_ID}/mentions",
                     params={"comment_id": ctx["comment_id"], "media_id": ctx["media_id"], "message": text[:2200]})
    elif kind == "dm":
        await _graph("POST", f"/{META_IG_USER_ID}/messages",
                     json={"recipient": {"id": ctx["recipient_id"]}, "message": {"text": text[:1000]}})


# ================================================================== simulator (demo)
async def send_sim(msg: Message, text: str) -> None:
    ctx = msg.reply_ctx or {}
    async with session_scope() as s:
        if ctx.get("kind") == "dm":
            s.add(DemoSocial(kind="dm", author=DEMO_PROFILE, text=text, is_bot=True, parent_id=ctx.get("thread_user_id")))
        else:
            s.add(DemoSocial(kind="comment", post_id=ctx.get("post_id"), parent_id=ctx.get("comment_id"),
                             author=DEMO_PROFILE, text=text, is_bot=True))


async def _ensure_demo_post(s: AsyncSession) -> None:
    if (await s.execute(select(DemoSocial).where(DemoSocial.kind == "post").limit(1))).scalar() is None:
        s.add(DemoSocial(kind="post", author=DEMO_PROFILE, text=(
            "DEMO • 2026/2027 o'quv yili: OTMlarda o'qishni ko'chirish va tiklash bo'yicha ariza qabul qilish "
            "boshlandi. Savollaringizni izohlarda qoldiring! (Bu — Darcha demo profili.)")))
        await s.flush()


class SimPost(BaseModel):
    text: str = Field(min_length=1)


class SimComment(BaseModel):
    post_id: int
    author: str = "demo_user"
    text: str = Field(min_length=1)
    mention: bool = False           # comment tags @darcha.demo
    foreign_page: bool = False      # simulates a tag under someone else's post


class SimDM(BaseModel):
    author: str = "demo_user"
    text: str = Field(min_length=1)


def _guard():
    if not ENABLE_SIMULATOR:
        raise HTTPException(404, "simulator disabled")


@dev.get("/feed", dependencies=[Depends(_guard)])
async def sim_feed(s: AsyncSession = Depends(get_session, scope="function")):
    await _ensure_demo_post(s)
    rows = (await s.execute(select(DemoSocial).order_by(DemoSocial.id))).scalars().all()
    posts = [r for r in rows if r.kind == "post"]
    comments = [r for r in rows if r.kind == "comment"]

    def node(r):
        return {"id": r.id, "author": r.author, "text": r.text, "is_bot": r.is_bot,
                "created_at": r.created_at.isoformat(),
                "replies": [node(c) for c in comments if c.parent_id == r.id]}
    return {
        "profile": {"username": DEMO_PROFILE, "name": "Darcha Demo", "is_demo": True},
        "posts": [{"id": p.id, "text": p.text, "created_at": p.created_at.isoformat(),
                   "comments": [node(c) for c in comments if c.post_id == p.id and c.parent_id is None]}
                  for p in reversed(posts)],
        "dms": [{"id": r.id, "author": r.author, "text": r.text, "is_bot": r.is_bot,
                 "created_at": r.created_at.isoformat()} for r in rows if r.kind == "dm"],
    }


@dev.post("/posts", dependencies=[Depends(_guard)])
async def sim_post(body: SimPost, s: AsyncSession = Depends(get_session, scope="function")):
    p = DemoSocial(kind="post", author=DEMO_PROFILE, text=body.text)
    s.add(p)
    await s.flush()
    return {"id": p.id}


@dev.post("/comments", dependencies=[Depends(_guard)])
async def sim_comment(body: SimComment):
    async with session_scope() as s:
        c = DemoSocial(kind="comment", post_id=body.post_id, author=body.author,
                       text=(f"@{DEMO_PROFILE} " if body.mention else "") + body.text)
        s.add(c)
        await s.flush()
        cid = c.id
    result = await handle(InboundMessage(
        channel="instagram_mention" if body.mention else "instagram_comment", external_id=f"sim:{cid}",
        thread_ref=f"sim:{body.post_id}", author=Author(external_id=f"sim:{body.author}", display=body.author),
        text=body.text, is_public=True, is_mention=body.mention, is_foreign_page=body.foreign_page,
        reply_ctx={"simulated": True, "kind": "comment", "post_id": body.post_id, "comment_id": cid},
    ))
    return {"comment_id": cid, "level": result["level"], "reason": result["reason"],
            "ticket_number": result["ticket_number"]}


@dev.post("/dm", dependencies=[Depends(_guard)])
async def sim_dm(body: SimDM):
    async with session_scope() as s:
        d = DemoSocial(kind="dm", author=body.author, text=body.text)
        s.add(d)
        await s.flush()
        did = d.id
    result = await handle(InboundMessage(
        channel="instagram_dm", external_id=f"sim:{did}", thread_ref=f"simdm:{body.author}",
        author=Author(external_id=f"sim:{body.author}", display=body.author), text=body.text,
        reply_ctx={"simulated": True, "kind": "dm", "thread_user_id": did},
    ))
    return {"dm_id": did, "level": result["level"], "ticket_number": result["ticket_number"]}


def setup() -> None:
    register("simulator", send_sim)
    if META_ACCESS_TOKEN and META_IG_USER_ID:
        register("instagram", send_real)
        log.info("instagram (Meta Graph API) sender enabled")
