"""All settings come from environment variables (.env in the repo root or in backend/)."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent
load_dotenv(REPO_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str, default: str = "") -> list[str]:
    return [x.strip() for x in os.getenv(name, default).split(",") if x.strip()]


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://edu:edu@localhost:5432/darcha")
DATA_DIR = Path(os.getenv("DATA_DIR", REPO_DIR / "data"))
PROMPTS_DIR = Path(__file__).resolve().parent / "llm" / "prompts"

# --- LLM (all calls go through app/llm/client.py) ---
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic")   # anthropic | gemini
LLM_MODEL = os.getenv("LLM_MODEL", "claude-opus-5-5" if LLM_PROVIDER == "anthropic" else "gemini-3.8-flash")
LLM_EFFORT = os.getenv("LLM_EFFORT", "low")          # low = fastest; target is <10 s per green answer
LLM_TIMEOUT_S = float(os.getenv("LLM_TIMEOUT_S", "45"))

# --- Retrieval ---
EMBED_MODEL = os.getenv("EMBED_MODEL", "BAAI/bge-m3")
EMBED_DIM = int(os.getenv("EMBED_DIM", "1024"))
RERANK_MODEL = os.getenv("RERANK_MODEL", "BAAI/bge-reranker-v2-m3")
USE_RERANKER = _bool("USE_RERANKER", True)
DEVICE = os.getenv("DEVICE", "auto")                  # auto | cuda | cpu
RETRIEVE_PER_METHOD = int(os.getenv("RETRIEVE_PER_METHOD", "8"))
RETRIEVE_FINAL = int(os.getenv("RETRIEVE_FINAL", "4"))

# --- Level thresholds (section 7 of the doc; tune on the eval set) ---
GREEN_MIN_CONFIDENCE = float(os.getenv("GREEN_MIN_CONFIDENCE", "0.8"))
RED_MAX_CONFIDENCE = float(os.getenv("RED_MAX_CONFIDENCE", "0.5"))
# cosine -> "support" mapping for cross-lingual questions (reranker scores are tiny across languages)
VEC_SIM_FLOOR = float(os.getenv("VEC_SIM_FLOOR", "0.40"))
VEC_SIM_FULL = float(os.getenv("VEC_SIM_FULL", "0.58"))

# --- Tickets ---
# Law "On appeals of individuals and legal entities": verify the exact terms in the current edition on lex.uz.
TICKET_DUE_DAYS = int(os.getenv("TICKET_DUE_DAYS", "15"))
TICKET_DUE_DAYS_HIGH = int(os.getenv("TICKET_DUE_DAYS_HIGH", "5"))
TICKET_PREFIX = os.getenv("TICKET_PREFIX", "DR")
HOTLINES = os.getenv("HOTLINES", "1006")                # shown in anti-fraud warnings; confirm the real numbers

# --- Auth ---
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_TTL_HOURS = int(os.getenv("JWT_TTL_HOURS", "24"))
CORS_ORIGINS = _list("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CHAT_RATE_LIMIT_PER_MIN = int(os.getenv("CHAT_RATE_LIMIT_PER_MIN", "20"))

# --- Telegram ---
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_MODE = os.getenv("TELEGRAM_MODE", "polling")   # polling (dev, no public URL) | webhook | off
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "")      # https://<host> for webhooks
TG_ALERT_CHAT_ID = os.getenv("TG_ALERT_CHAT_ID", "")    # chat that receives fraud/violence/spike alerts + reports

# --- Meta / Instagram ---
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "")
META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN", "")
META_IG_USER_ID = os.getenv("META_IG_USER_ID", "")
META_GRAPH_URL = os.getenv("META_GRAPH_URL", "https://graph.facebook.com/v21.0")
ENABLE_SIMULATOR = _bool("ENABLE_SIMULATOR", True)      # /api/dev/instagram/* mock profile for the demo

# --- Voice (optional) ---
ENABLE_VOICE = _bool("ENABLE_VOICE", False)
ASR_MODEL = os.getenv("ASR_MODEL", "navai-uz/whisper-small-uzbek")

# --- Background jobs ---
BACKGROUND_JOBS = _bool("BACKGROUND_JOBS", True)        # SLA checker + spike alerts loop
JOBS_INTERVAL_S = int(os.getenv("JOBS_INTERVAL_S", "300"))
