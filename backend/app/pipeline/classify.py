"""Step 3: classification (one LLM call, JSON)."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.config import LLM_MODEL
from app.db.session import REGIONS, TOPICS
from app.llm.client import LLMError, complete_json

log = logging.getLogger("classify")

TYPES = ["question", "complaint", "suggestion", "gratitude", "spam", "insult"]
FLAGS = ["children", "corruption", "fraud", "violence", "complaint_about_person", "personal_case",
         "political", "off_topic", "prompt_injection",
         # requests the bot must refuse with a fixed reply (never an AI-written answer):
         "personal_data_request", "cheating", "forgery", "defamation", "harmful_request"]
REFUSAL_FLAGS = ["personal_data_request", "forgery", "cheating", "defamation", "harmful_request"]   # priority order
SENSITIVE_FLAGS = {"children", "corruption", "complaint_about_person"}
TOPIC_CODES = [t[0] for t in TOPICS]

SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": TYPES},
        "topic": {"type": "string", "enum": TOPIC_CODES},
        "region": {"type": "string", "enum": REGIONS + ["unknown"]},
        "sentiment": {"type": "string", "enum": ["negative", "neutral", "positive"]},
        "urgency": {"type": "string", "enum": ["low", "normal", "high"]},
        "flags": {"type": "array", "items": {"type": "string", "enum": FLAGS}},
        "summary_uz": {"type": "string"},
    },
    "required": ["type", "topic", "region", "sentiment", "urgency", "flags", "summary_uz"],
    "additionalProperties": False,
}


@dataclass
class ClassificationResult:
    type: str = "question"
    topic: str = "other"
    region: str | None = None
    sentiment: str = "neutral"
    urgency: str = "normal"
    flags: list[str] = field(default_factory=list)
    summary_uz: str = ""
    model: str = LLM_MODEL
    failed: bool = False


async def classify(text_masked: str, channel: str, is_public: bool) -> ClassificationResult:
    try:
        data = await complete_json(
            "classify", SCHEMA, max_tokens=1500,
            topics="; ".join(f"{c}: {uz}" for c, uz, _, _ in TOPICS),
            regions=", ".join(REGIONS),
            channel=channel, is_public=is_public, text=text_masked,
        )
    except LLMError as e:
        log.warning("classification failed: %s", e)
        return ClassificationResult(summary_uz=text_masked[:150], failed=True)
    region = None if data["region"] == "unknown" else data["region"]
    return ClassificationResult(
        type=data["type"], topic=data["topic"], region=region, sentiment=data["sentiment"],
        urgency=data["urgency"], flags=sorted(set(data["flags"])), summary_uz=data["summary_uz"],
    )
