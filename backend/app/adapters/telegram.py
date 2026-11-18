"""Telegram adapter (aiogram 3).

Sees: private messages; comments in the channel's linked discussion group (bot must be an admin there
with privacy mode OFF); messages in groups that mention @bot or reply to the bot. Telegram does not let
a bot see mentions of the ministry's channel in chats the bot is not in.

Modes: TELEGRAM_MODE=polling (local dev, no public URL needed) | webhook (POST /webhooks/telegram) | off.
"""
from __future__ import annotations

import asyncio
import html
import io
import logging
import re

from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ChatAction, ChatType
from aiogram.types import Message as TgMessage
from aiogram.types import ReplyParameters, Update
from fastapi import APIRouter, Header, HTTPException, Request

from app.adapters.base import register
from app.config import (ENABLE_VOICE, PUBLIC_BASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_MODE, TELEGRAM_MODE,
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


_Q_WORDS = re.compile(
    r"(?i)\b(qanday|qachon|qayer\w*|nima\w*|nega|kim\w*|qancha|necha|qaysi|mumkinmi|bormi|kerakmi|"
    r"қандай|қачон|қаер\w*|нима\w*|нега|ким\w*|қанча|неча|қайси|мумкинми|борми|керакми|"
    r"как\w*|что|когда|где|почему|зачем|сколько|можно|нужно|ли)\b|\w+(mi|ми)\b")


def _looks_like_question(text: str) -> bool:
    """Group chatter ("salom", "ok", "rahmat") is left alone; real questions are answered without a mention."""
    t = (text or "").strip()
    return len(t) >= 12 and ("?" in t or bool(_Q_WORDS.search(t)))


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
    elif TELEGRAM_GROUP_MODE == "questions" and _looks_like_question(m.text):
        await _process(m, m.text, "telegram_group", is_public=True, is_mention=False)


# ------------------------------------------------------------------ outbound
FOOTER = {"ru": "🤖 Ответ подготовлен автоматически по документам lex.uz. Остались вопросы — напишите.",
          "uz-cyrillic": "🤖 Жавоб lex.uz ҳужжатлари асосида автоматик тайёрланди. Савол қолса — ёзинг.",
          "uz": "🤖 Javob lex.uz hujjatlari asosida avtomatik tayyorlandi. Savol qolsa — yozing."}


def _esc(t: str) -> str:
    return html.escape(t, quote=False)


def to_html(text: str, lang: str | None = None, script: str | None = None) -> str:
    """Plain reply -> Telegram HTML: bold first line, clickable sources, bold bullet labels, small footer."""
    lines, out, i = text.split("\n"), [], 0
    has_sources = any(line.startswith("📚 ") for line in lines)
    first_done = False
    while i < len(lines):
        line = lines[i]
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        if line.startswith("📚 "):
            out.append(f"<b>{_esc(line)}</b>")
        elif line.startswith("• ") and nxt.startswith("  http"):
            out.append(f'• <a href="{html.escape(nxt.strip(), quote=True)}">{_esc(line[2:])}</a>')
            i += 1
        elif line.startswith("👉 "):
            out.append(f"<b>{_esc(line)}</b>")
        elif line.startswith("• ") and ":" in line[:40]:
            head, _, rest = line[2:].partition(":")
            out.append(f"• <b>{_esc(head)}:</b>{_esc(rest)}")
        elif not first_done and line.strip():
            out.append(f"<b>{_esc(line)}</b>")
            first_done = True
        else:
            out.append(_esc(line))
        i += 1
    body = re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()
    if has_sources:   # only on AI answers, not on templates/tickets
        key = "ru" if lang == "ru" else ("uz-cyrillic" if script == "cyrillic" else "uz")
        body += f"\n\n<i>{FOOTER[key]}</i>"
    return body


async def send(msg: Message, text: str) -> None:
    ctx = msg.reply_ctx or {}
    chat_id, reply_to = ctx.get("chat_id"), ctx.get("message_id")
    rendered = to_html(text, msg.lang, msg.script)
    if len(rendered) <= MAX_LEN:
        try:
            await _bot.send_message(
                chat_id, rendered, parse_mode="HTML", disable_web_page_preview=True,
                reply_parameters=ReplyParameters(message_id=reply_to, allow_sending_without_reply=True)
                if reply_to else None)
            return
        except Exception:
            log.warning("HTML send failed, falling back to plain text", exc_info=True)
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
