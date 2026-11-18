"""DEMO DATA: spread ~150 synthetic appeals over the last 30 days so analytics periods (7/14/30) differ
and the daily chart has a real shape. No LLM calls, no real people.

    backend/.venv/bin/python scripts/seed_demo_history.py            # only if the DB has < 50 live messages
    backend/.venv/bin/python scripts/seed_demo_history.py --remove   # delete everything this script created

Every row is clearly marked: citizen channel "demo", display "Demo fuqaro", reply_ctx {"demo_history": true}.
"""
from __future__ import annotations

import argparse
import asyncio
import random
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.api.analytics import EXCLUDED
from app.db.models import Citizen, Classification, Message, Response, Topic
from app.db.session import init_db, session_scope
from app.kb.translit import to_search_form
from sqlalchemy import delete, func, select

TOTAL = 150
MIN_LIVE = 50

# (topic, weight, [questions]) - typical citizen questions, written for the demo
TOPICS = [
    ("contract_payment", 18, ["Kontrakt pulini bo'lib to'lasa bo'ladimi?", "Kontrakt to'lovi muddati qachon tugaydi?",
                              "Как оплатить контракт частями?", "Pedagog farzandlari kontraktga chegirma oladimi?"]),
    ("transfer_higher", 12, ["Boshqa OTMga qanday o'tish mumkin?", "Перевод из частного вуза в государственный возможен?",
                             "Sirtqidan kunduzgiga o'tsa bo'ladimi?"]),
    ("restore_higher", 9, ["O'qishni qayta tiklash tartibi qanday?", "Chetlatilgandan keyin qancha vaqtda tiklanish mumkin?"]),
    ("grants_stipend", 9, ["Grantlar qayta taqsimlanishi qachon bo'ladi?", "Stipendiya miqdori qancha?"]),
    ("admission", 10, ["Qabul hujjatlari qachondan topshiriladi?", "Когда начинается приём документов в вузы?"]),
    ("teacher_attestation", 10, ["Pedagoglar attestatsiyasi qachon o'tkaziladi?", "Attestatsiyadan o'tmasa nima bo'ladi?"]),
    ("teacher_certification", 7, ["Sertifikat uchun ustama necha foiz?", "Какая надбавка за национальный сертификат?"]),
    ("teacher_salary", 6, ["O'qituvchilar maoshi qachon oshadi?", "Ta'til puli qachon to'lanadi?"]),
    ("school_transfer", 8, ["Bolani boshqa maktabga qanday o'tkazaman?", "Maktabga necha yoshdan qabul qilinadi?"]),
    ("school_textbooks", 4, ["Darsliklar qachon tarqatiladi?"]),
    ("school_exams", 4, ["Bitiruv imtihonlari qachon boshlanadi?"]),
    ("preschool", 6, ["Bog'chaga navbat qanday olinadi?", "Как встать в очередь в детский сад?"]),
    ("diploma_docs", 4, ["Diplom dublikatini qanday olish mumkin?"]),
    ("corruption", 3, ["Maktab direktori pul so'rayapti, qayerga murojaat qilay?"]),
    ("other", 5, ["Rahmat, javob uchun katta rahmat!", "Vazirlik ish vaqti qanday?"]),
]
REGIONS = [("Toshkent shahri", 22), ("Toshkent viloyati", 10), ("Samarqand viloyati", 10), ("Farg'ona viloyati", 9),
           ("Andijon viloyati", 8), ("Namangan viloyati", 8), ("Qashqadaryo viloyati", 7), ("Buxoro viloyati", 6),
           ("Surxondaryo viloyati", 5), ("Xorazm viloyati", 5), ("Jizzax viloyati", 3), ("Navoiy viloyati", 3),
           ("Sirdaryo viloyati", 2), ("Qoraqalpog'iston Respublikasi", 4)]
CHANNELS = [("telegram_dm", 34), ("web", 26), ("telegram_comment", 16), ("instagram_comment", 14), ("instagram_dm", 6),
            ("telegram_group", 4)]
LEVELS = [("green", 55), ("gray", 8), ("yellow", 20), ("red", 12), ("none", 5)]


def pick(pairs):
    items, weights = zip(*[(p[0], p[1]) for p in pairs])
    return random.choices(items, weights=weights)[0]


def when(now: datetime) -> datetime:
    """Last 30 days, busier on weekdays and in office hours, slowly growing towards today."""
    while True:
        days = random.triangular(0, 30, 0)          # more recent days are more likely
        t = now - timedelta(days=days)
        t = t.replace(hour=random.choices(range(24), weights=[1, 1, 1, 1, 1, 2, 3, 5, 8, 10, 10, 9, 8, 9, 10, 10, 9,
                                                                8, 7, 6, 5, 4, 2, 1])[0],
                      minute=random.randrange(60))
        if t < now and (t.weekday() < 5 or random.random() < 0.45):
            return t


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--remove", action="store_true")
    ap.add_argument("--force", action="store_true", help="seed even if the DB already has >= 50 live messages")
    args = ap.parse_args()
    await init_db()
    async with session_scope() as s:
        demo = (await s.execute(select(Citizen).where(Citizen.channel == "demo"))).scalar()
        if args.remove:
            if demo:
                ids = select(Message.id).where(Message.citizen_id == demo.id)
                await s.execute(delete(Response).where(Response.message_id.in_(ids)))
                await s.execute(delete(Classification).where(Classification.message_id.in_(ids)))
                n = (await s.execute(delete(Message).where(Message.citizen_id == demo.id))).rowcount
                await s.delete(demo)
                print(f"removed {n} demo messages")
            return
        if demo:
            print("demo history already present (use --remove first)")
            return
        live = (await s.execute(select(func.count()).select_from(Message).where(Message.channel.not_in(EXCLUDED)))).scalar()
        if live >= MIN_LIVE and not args.force:
            print(f"{live} live messages already - not seeding demo history")
            return
        topics = {t.code: t.id for t in (await s.execute(select(Topic))).scalars()}
        demo = Citizen(channel="demo", external_id="demo-history", display="Demo fuqaro")
        s.add(demo)
        await s.flush()
        random.seed(2026)
        now = datetime.now(UTC)
        for _ in range(TOTAL):
            code = pick(TOPICS)
            text = random.choice(next(q for c, _, q in TOPICS if c == code))
            ru = any("а" <= ch <= "я" for ch in text.lower())
            level = "red" if code == "corruption" else ("gray" if text.startswith("Rahmat") else pick(LEVELS))
            channel = pick(CHANNELS)
            t = when(now)
            m = Message(citizen_id=demo.id, channel=channel, text_raw=text, text_masked=text, text_latin=to_search_form(text),
                        lang="ru" if ru else "uz", script="cyrillic" if ru else "latin",
                        is_public=channel.endswith(("comment", "group")), received_at=t,
                        reply_ctx={"demo_history": True})
            s.add(m)
            await s.flush()
            s.add(Classification(
                message_id=m.id, type="complaint" if code == "corruption" else
                ("gratitude" if level == "gray" else ("complaint" if level == "red" else "question")),
                topic_id=topics.get(code), region=pick(REGIONS),
                sentiment="negative" if level == "red" else ("positive" if level == "gray" else "neutral"),
                urgency="high" if code == "corruption" else "normal", flags=["corruption"] if code == "corruption" else [],
                model="demo-seed"))
            age_days = (now - t).total_seconds() / 86400
            if level in ("green", "gray"):
                s.add(Response(message_id=m.id, level=level, kind="ai" if level == "green" else "template",
                               answer_text="(demo)", confidence=round(random.uniform(0.72, 0.95), 2), status="sent",
                               sent_at=t + timedelta(seconds=8), latency_ms=random.randint(4000, 14000),
                               rating=random.choice([None, None, 4, 5, 5]), reason="demo history"))
            elif level == "yellow":
                done = age_days > 1.5 or random.random() < 0.4
                s.add(Response(message_id=m.id, level="yellow", kind="ai", answer_text="(demo draft)",
                               confidence=round(random.uniform(0.45, 0.7), 2), status="approved" if done else "draft",
                               sent_at=t + timedelta(hours=random.uniform(1, 20)) if done else None,
                               latency_ms=random.randint(5000, 15000), reason="demo history"))
            elif level == "red":
                s.add(Response(message_id=m.id, level="red", kind="template", answer_text="(demo ticket notice)",
                               status="sent", sent_at=t + timedelta(seconds=6), latency_ms=random.randint(3000, 9000),
                               reason="demo history"))
                if age_days > 3 or random.random() < 0.3:
                    s.add(Response(message_id=m.id, level="red", kind="specialist", answer_text="(demo specialist answer)",
                                   status="sent", sent_at=t + timedelta(days=random.uniform(1, 3)), reason="demo history"))
            else:
                s.add(Response(message_id=m.id, level="none", kind="ai", status="skipped", reason="demo history: spam"))
        print(f"seeded {TOTAL} demo appeals over the last 30 days (citizen channel 'demo')")


if __name__ == "__main__":
    asyncio.run(main())
