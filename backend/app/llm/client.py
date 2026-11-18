"""The ONLY place that talks to an LLM (team rule from section 11).

Swapping to a local model (vLLM) later = reimplement `complete_json` here; nothing else changes.

Prompts live in app/llm/prompts/<name>.md as:

    <system prompt>
    ===USER===
    <user template with {{variables}}>
"""
from __future__ import annotations

import asyncio
import json
import logging
from functools import lru_cache

import anthropic

from app.config import LLM_EFFORT, LLM_MODEL, LLM_PROVIDER, LLM_TIMEOUT_S, PROMPTS_DIR

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
    if LLM_PROVIDER == "openrouter":
        return await _openrouter_json(system, render(user_tpl, **variables), schema, max_tokens)
    if LLM_PROVIDER == "gemini":
        return await _gemini_json(system, render(user_tpl, **variables), schema, max_tokens)
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


# ---------------------------------------------------------------- Gemini (LLM_PROVIDER=gemini, GEMINI_API_KEY)
@lru_cache
def _gemini():
    from google import genai
    return genai.Client()   # reads GEMINI_API_KEY; timeout enforced locally (the SDK's becomes a server deadline -> 504)


def _gemini_thinking(types):
    """Least thinking the model allows: 2.5 takes a token budget, 3.x a level."""
    if LLM_MODEL.startswith("gemini-2.5") and "flash" in LLM_MODEL:
        return types.ThinkingConfig(thinking_budget=0)
    if "thinking_level" in types.ThinkingConfig.model_fields:
        return types.ThinkingConfig(thinking_level="low")
    return None


async def _gemini_json(system: str, user: str, schema: dict, max_tokens: int) -> dict:
    from google.genai import errors, types
    config = types.GenerateContentConfig(
        system_instruction=system, max_output_tokens=max_tokens, temperature=0.2,
        response_mime_type="application/json", response_json_schema=schema,
        # thinking off = fastest (target <10 s); supported on 2.5-flash
        thinking_config=_gemini_thinking(types),
    )
    try:
        response = await asyncio.wait_for(
            _gemini().aio.models.generate_content(model=LLM_MODEL, contents=user, config=config), LLM_TIMEOUT_S)
    except errors.APIError as e:
        raise LLMError(f"gemini {e.code}: {str(e.message)[:200]}") from e
    except Exception as e:   # network / timeout
        raise LLMError(f"gemini connection: {type(e).__name__}") from e
    cand = (response.candidates or [None])[0]
    reason = str(getattr(cand, "finish_reason", "") or "")
    if "SAFETY" in reason or "PROHIBITED" in reason or (response.prompt_feedback and response.prompt_feedback.block_reason):
        raise LLMError("refusal")
    if "MAX_TOKENS" in reason:
        raise LLMError("max_tokens")
    try:
        return json.loads(response.text or "")
    except json.JSONDecodeError as e:
        raise LLMError("bad json") from e


# ---------------------------------------------------------------- OpenRouter (LLM_PROVIDER=openrouter)
# OPENROUTER_PROVIDER pins one upstream (e.g. "relace"), no fallbacks. Relace has no response_format,
# so the schema goes into the system prompt and the reply is parsed and checked here.
import os  # noqa: E402
import re  # noqa: E402

import httpx  # noqa: E402


@lru_cache
def _http() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url="https://openrouter.ai/api/v1", timeout=LLM_TIMEOUT_S,
                             headers={"Authorization": f"Bearer {os.environ.get('OPENROUTER_API_KEY', '')}",
                                      "X-Title": "Darcha"})


def _extract_json(text: str) -> dict:
    text = re.sub(r"(?s)<think>.*?</think>", "", text or "").strip()
    m = re.search(r"(?s)```(?:json)?\s*(\{.*\})\s*```", text)
    if m:
        text = m[1]
    else:
        a, b = text.find("{"), text.rfind("}")
        text = text[a:b + 1] if a >= 0 and b > a else text
    return json.loads(text)


def _check(data, schema: dict) -> None:
    """Minimal schema check: required keys present, enums respected (top level and one level down)."""
    if not isinstance(data, dict):
        raise ValueError("not an object")
    for k in schema.get("required", []):
        if k not in data:
            raise ValueError(f"missing {k}")
    for k, sub in (schema.get("properties") or {}).items():
        if k in data and "enum" in sub and data[k] not in sub["enum"]:
            raise ValueError(f"{k} not in enum")


async def _openrouter_json(system: str, user: str, schema: dict, max_tokens: int) -> dict:
    sys_full = (system + "\n\nReply with ONE JSON object only, no prose, no code fences. It must match this JSON Schema:\n"
                + json.dumps(schema, ensure_ascii=False))
    provider = os.environ.get("OPENROUTER_PROVIDER")
    body = {"model": LLM_MODEL, "max_tokens": max_tokens, "temperature": 0.2,
            "messages": [{"role": "system", "content": sys_full}, {"role": "user", "content": user}],
            "reasoning": {"effort": "low", "exclude": True}}   # Relace: reasoning is mandatory; keep it short
    if provider:
        body["provider"] = {"only": [provider], "allow_fallbacks": False}
    last = None
    for _attempt in range(2):   # one retry if the model returns broken JSON
        for wait in (2, 5, 10, 20, None):   # 429/5xx from the pinned provider: back off, never switch provider
            try:
                r = await _http().post("/chat/completions", json=body)
            except httpx.HTTPError as e:
                raise LLMError(f"openrouter connection: {type(e).__name__}") from e
            if r.status_code in (429, 502, 503) and wait:
                await asyncio.sleep(wait)
                continue
            break
        if r.status_code != 200:
            raise LLMError(f"openrouter {r.status_code}: {r.text[:200]}")
        data = r.json()
        if data.get("error"):
            raise LLMError(f"openrouter: {str(data['error'])[:200]}")
        choice = data["choices"][0]
        if choice.get("finish_reason") == "length":
            raise LLMError("max_tokens")
        try:
            out = _extract_json(choice["message"].get("content") or "")
            _check(out, schema)
            return out
        except (ValueError, json.JSONDecodeError) as e:
            last = e
    raise LLMError(f"bad json: {last}")
