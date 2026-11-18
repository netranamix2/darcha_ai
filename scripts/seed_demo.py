"""Load real public comments for the FAQ-report demo and build two weekly reports (so trends show up).

    python scripts/seed_demo.py data/comments            # classify only (1 LLM call per comment)
    python scripts/seed_demo.py data/comments --answer   # full pipeline incl. answers/tickets (slower, costlier)

data/comments/*.jsonl, one comment per line:
  {"text": "...", "region": "Farg'ona"?, "channel": "telegram_comment"?, "received_at": "2026-11-10T09:00:00+05:00"?,
   "source": "t.me/... post link"?}
Comments without received_at are spread evenly over the last 14 days.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import select  # noqa: E402

from app.analytics import faq_report  # noqa: E402
from app.db.models import Citizen, Classification, Message, Topic  # noqa: E402
from app.db.session import init_db, session_scope  # noqa: E402
from app.pipeline.classify import classify  # noqa: E402
from app.pipeline.inbound import Author, InboundMessage  # noqa: E402
from app.pipeline.normalize import normalize  # noqa: E402
from app.pipeline.process import handle  # noqa: E402


async def store_classified(row: dict, sem: asyncio.Semaphore) -> None:
    async with sem:
        norm = normalize(row["text"])
        cls = await classify(norm.text_masked, row["channel"], True)
    async with session_scope() as s:
        cit = (await s.execute(select(Citizen).where(Citizen.channel == "seed", Citizen.external_id == "seed"))).scalar()
        if cit is None:
            cit = Citizen(channel="seed", external_id="seed", display="seed")
            s.add(cit)
            await s.flush()
        m = Message(citizen_id=cit.id, channel=row["channel"], text_raw=norm.text_raw, text_masked=norm.text_masked,
                    text_latin=norm.text_latin, lang=norm.lang, script=norm.script, is_public=True,
                    received_at=row["received_at"], thread_ref=row.get("source"), reply_ctx={"seed": True})
        s.add(m)
        await s.flush()
        topic = (await s.execute(select(Topic).where(Topic.code == cls.topic))).scalar()
        s.add(Classification(message_id=m.id, type=cls.type, topic_id=topic.id if topic else None,
                             region=row.get("region") or cls.region, sentiment=cls.sentiment, urgency=cls.urgency,
                             flags=cls.flags, model=cls.model))


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", nargs="?", default="data/comments")
    ap.add_argument("--answer", action="store_true", help="run the full pipeline (answers, tickets) for each comment")
    ap.add_argument("--no-report", action="store_true")
    args = ap.parse_args()

    await init_db()
    rows = []
    for f in sorted(Path(args.folder).glob("*.jsonl")):
        rows += [json.loads(x) for x in f.read_text(encoding="utf-8").splitlines() if x.strip()]
    if not rows:
        raise SystemExit(f"no comments in {args.folder}/*.jsonl")
    now = datetime.now(timezone.utc)
    random.seed(7)
    for i, r in enumerate(rows):
        r.setdefault("channel", "telegram_comment")
        if r.get("received_at"):
            r["received_at"] = datetime.fromisoformat(r["received_at"])
        else:
            r["received_at"] = now - timedelta(days=14) + timedelta(seconds=random.uniform(0, 14 * 86400))
    print(f"{len(rows)} comments")

    sem = asyncio.Semaphore(6)
    if args.answer:
        async def full(r):
            async with sem:
                await handle(InboundMessage(channel=r["channel"], author=Author(external_id="seed"), text=r["text"],
                                            is_public=True, received_at=r["received_at"]), send=False)
        await asyncio.gather(*(full(r) for r in rows))
    else:
        await asyncio.gather(*(store_classified(r, sem) for r in rows))
    print("stored")

    if not args.no_report:
        prev = await faq_report.run("week", end=now - timedelta(days=7))
        cur = await faq_report.run("week", end=now)
        print(f"FAQ reports built: previous week #{prev}, current week #{cur}")


if __name__ == "__main__":
    asyncio.run(main())
