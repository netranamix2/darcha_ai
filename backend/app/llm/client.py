"""The ONLY place that talks to an LLM (team rule from section 11).

Swapping to a local model (vLLM) later = reimplement `complete_json` here; nothing else changes.

Prompts live in app/llm/prompts/<name>.md as:

    <system prompt>
    ===USER===
    <user template with {{variables}}>
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache

import anthropic

from app.config import LLM_EFFORT, LLM_MODEL, LLM_TIMEOUT_S, PROMPTS_DIR

log = logging.getLogger("llm")


class LLMError(RuntimeError):
    pass


@lru_cache
def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(timeout=LLM_TIMEOUT_S, max_retries=2)


@lru_cache
def load_prompt(name: str) -> tuple[str, str]:
    raw = (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")
    system, _, user = raw.partition("===USER===")
    return system.strip(), user.strip()


def render(template: str, **variables) -> str:
    for key, value in variables.items():
        template = template.replace("{{" + key + "}}", str(value))
    return template


async def complete_json(prompt: str, schema: dict, *, effort: str | None = None, max_tokens: int = 4000,
                        **variables) -> dict:
    """Run prompt `prompt` with `variables`, return JSON guaranteed to match `schema`."""
    system, user_tpl = load_prompt(prompt)
    try:
        response = await _client().beta.messages.create(
            model=LLM_MODEL,
            max_tokens=max_tokens,
            # The system prompt is identical for every call of the same prompt -> cached.
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": render(user_tpl, **variables)}],
            output_config={"effort": effort or LLM_EFFORT, "format": {"type": "json_schema", "schema": schema}},
            # If a safety classifier declines, the API re-runs the request on a fallback model in the same call.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.APIConnectionError as e:
        raise LLMError(f"connection: {e}") from e
    except anthropic.RateLimitError as e:
        raise LLMError("rate limited") from e
    except anthropic.APIStatusError as e:
        raise LLMError(f"api {e.status_code}: {e.message}") from e

    if response.stop_reason == "refusal":
        raise LLMError("refusal")
    if response.stop_reason == "max_tokens":
        raise LLMError("max_tokens")
    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise LLMError("bad json") from e
