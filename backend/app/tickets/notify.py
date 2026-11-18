"""Notifications to staff (Telegram). Falls back to the log when the bot isn't configured."""
from __future__ import annotations

import logging

from app.config import TG_ALERT_CHAT_ID

log = logging.getLogger("notify")


async def send_telegram(chat_id: str | None, text: str) -> bool:
    chat_id = chat_id or TG_ALERT_CHAT_ID
    from app.adapters.telegram import get_bot
    bot = get_bot()
    if not bot or not chat_id:
        log.info("[notify, telegram not configured] %s", text)
        return False
    try:
        await bot.send_message(chat_id, text[:4000], disable_web_page_preview=True)
        return True
    except Exception:
        log.exception("telegram notify failed")
        return False


async def alert(text: str, chat_id: str | None = None) -> bool:
    return await send_telegram(chat_id, "🚨 " + text)
