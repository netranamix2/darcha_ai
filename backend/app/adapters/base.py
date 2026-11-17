"""Delivery registry: every channel adapter registers how to send a reply back.

The pipeline never knows about Telegram or Meta; it calls deliver(message, text).
"""
from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable

from app.db.models import Message

log = logging.getLogger("deliver")

Sender = Callable[[Message, str], Awaitable[None]]
_SENDERS: dict[str, Sender] = {}
# Stored in the DB and read by the client itself (web chat polls its history) or never sent.
NO_PUSH = {"web", "api", "eval", "virtual"}


def register(prefix: str, sender: Sender) -> None:
    _SENDERS[prefix] = sender


async def deliver(msg: Message, text: str) -> bool:
    prefix = "simulator" if (msg.reply_ctx or {}).get("simulated") else msg.channel.split("_")[0]
    if prefix in NO_PUSH:
        return True
    sender = _SENDERS.get(prefix)
    if sender is None:
        log.warning("no sender for channel %s (adapter not configured)", msg.channel)
        return False
    try:
        await sender(msg, text)
        return True
    except Exception:
        log.exception("delivery failed for message %s", msg.id)
        return False
