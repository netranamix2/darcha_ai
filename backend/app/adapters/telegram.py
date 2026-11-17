"""Telegram adapter (aiogram 3).

Sees: private messages; comments in the channel's linked discussion group (bot must be an admin there
with privacy mode OFF); messages in groups that mention @bot or reply to the bot. Telegram does not let
a bot see mentions of the ministry's channel in chats the bot is not in.

Modes: TELEGRAM_MODE=polling (local dev, no public URL needed) | webhook (POST /webhooks/telegram) | off.
"""
from __future__ import annotations

import asyncio
import io
import logging

from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ChatAction, ChatType
from aiogram.types import Message as TgMessage
from aiogram.types import ReplyParameters, Update
from fastapi import APIRouter, Header, HTTPException, Request

from app.adapters.base import register
from app.config import (ENABLE_VOICE, PUBLIC_BASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_MODE,
                        TELEGRAM_WEBHOOK_SECRET)
from app.db.models import Message
from app.pipeline.inbound import Author, InboundMessage
from app.pipeline.process import handle

log = logging.getLogger("telegram")
api = APIRouter(tags=["webhooks"])
tg_router = Router()
_bot: Bot | None = None
_dp: Dispatcher | None = None
_me = None
_tasks: set[asyncio.Task] = set()
MAX_LEN = 4000


def get_bot() -> Bot | None:
    return _bot


# ------------------------------------------------------------------ inbound
def _is_comment(m: TgMessage) -> bool:
    r = m.reply_to_message
    return bool(r and (r.is_automatic_forward or (r.sender_chat and r.sender_chat.type == ChatType.CHANNEL)))


def _mentions_bot(m: TgMessage) -> bool:
    if _me is None:
        return False
    if m.reply_to_message and m.reply_to_message.from_user and m.reply_to_message.from_user.id == _me.id:
        return True
    text = m.text or m.caption or ""
    for e in m.entities or m.caption_entities or []:
        if e.type == "mention" and text[e.offset:e.offset + e.length].lower() == f"@{_me.username}".lower():
            return True
        if e.type == "text_mention" and e.user and e.user.id == _me.id:
            return True
    return False


def _strip_mention(text: str) -> str:
    return text.replace(f"@{_me.username}", "").strip() if _me else text


async def _process(m: TgMessage, text: str, channel: str, is_public: bool, is_mention: bool) -> None:
    if not text.strip():
        return
    if m.chat.type == ChatType.PRIVATE:
        await m.bot.send_chat_action(m.chat.id, ChatAction.TYPING)
    thread = m.reply_to_message.message_id if m.reply_to_message else m.message_id
    user = m.from_user
    await handle(InboundMessage(
        channel=channel, external_id=f"{m.chat.id}:{m.message_id}", thread_ref=f"{m.chat.id}:{thread}",
        author=Author(external_id=str(user.id) if user else str(m.chat.id),
                      display=(user.full_name if user else m.chat.title)),
        text=text, is_public=is_public, is_mention=is_mention, received_at=m.date,
        reply_ctx={"chat_id": m.chat.id, "message_id": m.message_id},
    ))


@tg_router.message(F.chat.type == ChatType.PRIVATE, F.text.startswith("/start"))
async def on_start(m: TgMessage) -> None:
    await m.answer("Assalomu alaykum! Ta'lim tizimi bo'yicha savolingizni yozing — me'yoriy hujjatlar asosida "
                   "javob beraman. Здравствуйте! Напишите вопрос о системе образования.")


@tg_router.message(F.chat.type == ChatType.PRIVATE, F.text)
async def on_private_text(m: TgMessage) -> None:
    await _process(m, m.text, "telegram_dm", is_public=False, is_mention=False)


@tg_router.message(F.chat.type == ChatType.PRIVATE, F.voice)
async def on_private_voice(m: TgMessage) -> None:
    if not ENABLE_VOICE:
        await m.answer("Iltimos, savolingizni matn ko'rinishida yozing. / Пожалуйста, напишите вопрос текстом.")
        return
    from app.adapters import voice
    buf = io.BytesIO()
    await m.bot.download(m.voice, destination=buf)
    text = await asyncio.to_thread(voice.transcribe, buf.getvalue())
    if not text:
        await m.answer("Ovozli xabarni tushuna olmadim, matn ko'rinishida yozing.")
        return
    await m.reply(f"🎙 {text}")
    await _process(m, text, "telegram_dm", is_public=False, is_mention=False)


@tg_router.message(F.chat.type.in_({ChatType.GROUP, ChatType.SUPERGROUP}), F.text)
async def on_group_text(m: TgMessage) -> None:
    if m.is_automatic_forward or (m.from_user and _me and m.from_user.id == _me.id):
        return  # the channel post copy itself, or our own message
    if _is_comment(m):
        await _process(m, _strip_mention(m.text), "telegram_comment", is_public=True, is_mention=_mentions_bot(m))
    elif _mentions_bot(m):
        await _process(m, _strip_mention(m.text), "telegram_group", is_public=True, is_mention=True)


# ------------------------------------------------------------------ outbound
async def send(msg: Message, text: str) -> None:
    ctx = msg.reply_ctx or {}
    chat_id, reply_to = ctx.get("chat_id"), ctx.get("message_id")
    for i in range(0, len(text), MAX_LEN):
        await _bot.send_message(
            chat_id, text[i:i + MAX_LEN], disable_web_page_preview=True,
            reply_parameters=ReplyParameters(message_id=reply_to, allow_sending_without_reply=True)
            if reply_to and i == 0 else None,
        )


# ------------------------------------------------------------------ webhook + lifecycle
@api.post("/webhooks/telegram")
async def telegram_webhook(request: Request,
                           x_telegram_bot_api_secret_token: str | None = Header(default=None)):
    if _bot is None or _dp is None:
        raise HTTPException(503, "telegram is not configured")
    if TELEGRAM_WEBHOOK_SECRET and x_telegram_bot_api_secret_token != TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(403, "bad secret token")
    update = Update.model_validate(await request.json(), context={"bot": _bot})
    task = asyncio.create_task(_dp.feed_update(_bot, update))  # answer Telegram immediately
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"ok": True}


async def start() -> None:
    global _bot, _dp, _me
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_MODE == "off":
        log.info("telegram disabled")
        return
    _bot = Bot(TELEGRAM_BOT_TOKEN)
    _dp = Dispatcher()
    _dp.include_router(tg_router)
    _me = await _bot.get_me()
    register("telegram", send)
    if TELEGRAM_MODE == "webhook":
        if not PUBLIC_BASE_URL:
            raise RuntimeError("TELEGRAM_MODE=webhook needs PUBLIC_BASE_URL")
        await _bot.set_webhook(f"{PUBLIC_BASE_URL}/webhooks/telegram", secret_token=TELEGRAM_WEBHOOK_SECRET or None,
                               allowed_updates=["message"])
        log.info("telegram webhook set for @%s", _me.username)
    else:
        await _bot.delete_webhook(drop_pending_updates=False)
        task = asyncio.create_task(_dp.start_polling(_bot, handle_signals=False, allowed_updates=["message"]))
        _tasks.add(task)
        log.info("telegram polling started for @%s", _me.username)


async def stop() -> None:
    if _dp is not None:
        try:
            await _dp.stop_polling()
        except RuntimeError:
            pass
    if _bot is not None:
        await _bot.session.close()
