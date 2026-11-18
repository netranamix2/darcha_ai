"""The single inbound format every channel adapter produces (section 8)."""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

# Channel names. Prefix before "_" selects the delivery adapter.
CHANNELS = {
    "web",                      # website chat
    "telegram_dm", "telegram_comment", "telegram_group",
    "instagram_comment", "instagram_dm", "instagram_mention",
    "virtual_reception",        # text pasted by staff into the panel (draft only, never auto-sent)
    "api", "eval",              # /api/ask and the eval script (never delivered)
}
PUBLIC_CHANNELS = {"telegram_comment", "telegram_group", "instagram_comment", "instagram_mention"}


class Author(BaseModel):
    external_id: str
    display: str | None = None


class InboundMessage(BaseModel):
    channel: str
    external_id: str | None = None          # id of the message/comment in its channel
    thread_ref: str | None = None           # web session id, "chat:msg" for tg, media id for ig
    author: Author
    text: str
    is_public: bool = False
    is_mention: bool = False
    is_foreign_page: bool = False           # instagram mention under someone else's post
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reply_ctx: dict = Field(default_factory=dict)   # adapter-specific data needed to reply
