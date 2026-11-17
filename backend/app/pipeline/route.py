"""Step 7: choose the level (rules table in section 7). Pure function, unit-tested."""
from __future__ import annotations

from dataclasses import dataclass

from app.config import GREEN_MIN_CONFIDENCE, RED_MAX_CONFIDENCE
from app.pipeline.answer import AnswerResult
from app.pipeline.classify import SENSITIVE_FLAGS, ClassificationResult


@dataclass
class Decision:
    level: str              # green | yellow | red | none
    action: str             # answer | template | draft | ticket | ignore
    template: str | None    # templates.T key when action == template (or extra notice)
    alert: str | None       # fraud | violence -> immediate alert to the responsible person
    reason: str


def decide(cls: ClassificationResult, ans: AnswerResult, *, is_public: bool, is_foreign_page: bool) -> Decision:
    flags = set(cls.flags)

    if "fraud" in flags or "violence" in flags:
        kind = "violence" if "violence" in flags else "fraud"
        return Decision("red", "ticket", kind, kind, f"flag={kind}: warning template + ticket + immediate alert")

    if "prompt_injection" in flags or "political" in flags:
        f = "prompt_injection" if "prompt_injection" in flags else "political"
        return Decision("yellow", "draft", None, None, f"flag={f}: never answered automatically")

    if "off_topic" in flags and cls.type not in {"spam", "insult"}:   # sincere off-topic question, not an ad
        return Decision("green", "template", "off_topic", None, "off-topic: polite fixed reply")

    # Safety flags above outrank the type: the classifier sometimes calls an injection attempt "spam".
    if cls.type in {"spam", "insult"}:
        return Decision("none", "ignore", None, None, f"type={cls.type}: no reply, statistics only")

    if cls.type == "gratitude":
        return Decision("green", "template", "gratitude", None, "gratitude: fixed reply")

    red_reasons = []
    if ans.failed:
        red_reasons.append("answer generation failed")
    if not ans.citations:
        red_reasons.append("no valid citation / no document")
    if ans.confidence < RED_MAX_CONFIDENCE:
        red_reasons.append(f"confidence {ans.confidence:.2f} < {RED_MAX_CONFIDENCE}")
    if ans.needs_human:
        red_reasons.append("model says a human is needed")
    if "personal_case" in flags:
        red_reasons.append("personal case")
    if red_reasons:
        if is_foreign_page:   # never post ticket notices under other people's posts
            return Decision("yellow", "draft", None, None, "foreign page: " + "; ".join(red_reasons))
        return Decision("red", "ticket", None, None, "; ".join(red_reasons))

    yellow_reasons = []
    if flags & SENSITIVE_FLAGS:
        yellow_reasons.append("sensitive: " + ",".join(sorted(flags & SENSITIVE_FLAGS)))
    if cls.type == "complaint":
        yellow_reasons.append("public complaint" if is_public else "complaint")
    if cls.type == "suggestion":
        yellow_reasons.append("suggestion")
    if ans.confidence < GREEN_MIN_CONFIDENCE:
        yellow_reasons.append(f"confidence {ans.confidence:.2f} < {GREEN_MIN_CONFIDENCE}")
    if cls.failed:
        yellow_reasons.append("classification failed")
    if yellow_reasons:
        return Decision("yellow", "draft", None, None, "; ".join(yellow_reasons))

    return Decision("green", "answer", None, None,
                    f"question, no flags, confidence {ans.confidence:.2f}, {len(ans.citations)} valid citation(s)")
