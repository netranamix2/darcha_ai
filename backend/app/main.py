"""Darcha backend.

    uvicorn app.main:app --host 0.0.0.0 --port 8000      # Swagger: http://localhost:8000/docs
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters import meta, telegram
from app.api import analytics, auth, chat, documents, panel
from app.config import BACKGROUND_JOBS, CORS_ORIGINS, ENABLE_SIMULATOR, JOBS_INTERVAL_S
from app.db.session import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("main")


async def background_jobs() -> None:
    """In-process scheduler (no Redis on the hackathon): SLA reminders/escalation, spike alerts, weekly report."""
    from app.analytics import alerts, faq_report
    from app.db.session import session_scope
    from app.tickets import sla
    while True:
        await asyncio.sleep(JOBS_INTERVAL_S)
        for name, job in (("sla", sla.check_deadlines), ("spikes", alerts.spike_check)):
            try:
                await job()
            except Exception:
                log.exception("job %s failed", name)
        try:
            async with session_scope() as s:
                due = await faq_report.needs_weekly(s)
            if due:
                await faq_report.run("week")
        except Exception:
            log.exception("weekly report failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    from app.kb import embed
    await asyncio.to_thread(embed.warmup)          # load bge-m3 + reranker once, not on the first question
    meta.setup()
    await telegram.start()
    jobs = asyncio.create_task(background_jobs()) if BACKGROUND_JOBS else None
    yield
    if jobs:
        jobs.cancel()
    await telegram.stop()


app = FastAPI(title="Darcha", version="0.1.0", lifespan=lifespan,
              description="One AI core for citizen inquiries to the Ministry of Education and Science of Uzbekistan.")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(panel.router)
app.include_router(analytics.router)
app.include_router(documents.router)
app.include_router(telegram.api)
app.include_router(meta.api)
if ENABLE_SIMULATOR:
    app.include_router(meta.dev)


@app.get("/health")
async def health():
    return {"ok": True}
