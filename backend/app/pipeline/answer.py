"""Steps 5-6: generate an answer from the found fragments, then verify it in code.

The LLM's own confidence is only one signal. Final confidence also uses the retrieval
score of the cited fragments and whether the citations are valid (section 9).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.kb.translit import cyr_to_lat, detect_script, lat_to_cyr
from app.llm.client import LLMError, complete_json
from app.pipeline.retrieve import Hit

log = logging.getLogger("answer")

SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "citations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"chunk_id": {"type": "string"}, "ref": {"type": "string"}},
                "required": ["chunk_id", "ref"],
                "additionalProperties": False,
            },
        },
        "confidence": {"type": "number"},
        "needs_human": {"type": "boolean"},
    },
    "required": ["answer", "citations", "confidence", "needs_human"],
    "additionalProperties": False,
}


@dataclass
class AnswerResult:
    answer: str = ""
    citations: list[dict] = field(default_factory=list)   # validated: {chunk_id, title, ref, url}
    llm_confidence: float = 0.0
    confidence: float = 0.0
    needs_human: bool = True
    invalid_citations: list[str] = field(default_factory=list)
    failed: bool = False


def format_sources(hits: list[Hit]) -> str:
    return "\n\n".join(
        f'<source id="{h.chunk_id}" doc="{h.citation()["title"]}" ref="{h.article_ref}">\n{h.header}\n{h.text}\n</source>'
        for h in hits
    ) or "(nothing found)"


def verify(raw: dict, hits: list[Hit]) -> AnswerResult:
    """Keep only citations that point to retrieved fragments; compute final confidence."""
    by_id = {str(h.chunk_id): h for h in hits}
    valid, invalid = [], []
    for c in raw["citations"]:
        h = by_id.get(str(c["chunk_id"]))
        if h is None:
            invalid.append(str(c["chunk_id"]))
        elif not any(v["chunk_id"] == str(h.chunk_id) for v in valid):
            valid.append(h.citation())
    llm_conf = max(0.0, min(1.0, float(raw["confidence"])))
    if not valid:
        conf = min(llm_conf, 0.3)
    else:
        top = max(by_id[v["chunk_id"]].support for v in valid)
        conf = llm_conf * (0.6 + 0.4 * top)
    if invalid:
        conf *= 0.7
    return AnswerResult(
        answer=raw["answer"].strip(), citations=valid, llm_confidence=llm_conf, confidence=round(conf, 3),
        needs_human=bool(raw["needs_human"]), invalid_citations=invalid,
    )


def fix_script(text: str, lang: str, script: str) -> str:
    """Guarantee the Uzbek answer uses the question's alphabet even if the model slipped."""
    if lang == "ru":
        return text
    got = detect_script(text)
    if script == "cyrillic" and got == "latin":
        return lat_to_cyr(text)
    if script == "latin" and got == "cyrillic":
        return cyr_to_lat(text)
    return text


async def generate(question_masked: str, hits: list[Hit], lang: str, script: str, is_public: bool) -> AnswerResult:
    if not hits:
        return AnswerResult(needs_human=True)
    try:
        raw = await complete_json(
            "answer", SCHEMA, max_tokens=3000,
            lang=lang, script=script, sources=format_sources(hits), question=question_masked,
            public_note=("PUBLIC (a comment others can see): never ask for or repeat personal data; if personal "
                         "details are needed, suggest writing to the bot in private messages.")
            if is_public else "private.",
        )
    except LLMError as e:
        log.warning("answer generation failed: %s", e)
        return AnswerResult(needs_human=True, failed=True)
    res = verify(raw, hits)
    res.answer = fix_script(res.answer, lang, script)
    return res
