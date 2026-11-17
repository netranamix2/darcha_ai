from __future__ import annotations

from contextlib import asynccontextmanager

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import DATABASE_URL
from app.db.models import Base, Department, Staff, Topic

engine = create_async_engine(DATABASE_URL, pool_size=10, max_overflow=10, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@asynccontextmanager
async def session_scope():
    async with SessionLocal() as s:
        try:
            yield s
            await s.commit()
        except Exception:
            await s.rollback()
            raise


async def get_session():
    """FastAPI dependency. Always use Depends(get_session, scope="function"): the default "request"
    scope commits only after the response is sent, so a client could read stale data right after a
    write, and a failed commit would still have returned 200."""
    async with session_scope() as s:
        yield s


# --------------------------------------------------------------------- seed data
DEPARTMENTS = [
    ("higher_ed", "Oliy ta'lim departamenti"),
    ("teachers", "Pedagog kadrlar va attestatsiya boshqarmasi"),
    ("school", "Maktab ta'limi departamenti"),
    ("preschool", "Maktabgacha ta'lim boshqarmasi"),
    ("admission", "Qabul masalalari bo'limi"),
    ("appeals", "Murojaatlar bilan ishlash bo'limi"),   # default / everything else
    ("security", "Korrupsiyaga qarshi kurashish va xavfsizlik bo'limi"),
]

# code, name_uz, name_ru, department
TOPICS = [
    ("transfer_higher", "OTMda o'qishni ko'chirish", "Перевод в вузе", "higher_ed"),
    ("restore_higher", "O'qishni tiklash", "Восстановление в вузе", "higher_ed"),
    ("contract_payment", "Kontrakt to'lovi", "Оплата контракта", "higher_ed"),
    ("grants_stipend", "Grant va stipendiya", "Гранты и стипендии", "higher_ed"),
    ("admission", "Qabul (abituriyentlar)", "Приём (абитуриенты)", "admission"),
    ("diploma_docs", "Diplom va hujjatlar", "Дипломы и документы", "higher_ed"),
    ("teacher_attestation", "O'qituvchilar attestatsiyasi", "Аттестация учителей", "teachers"),
    ("teacher_category", "Malaka toifasi", "Квалификационная категория", "teachers"),
    ("teacher_certification", "Sertifikatlash va ustamalar", "Сертификация и надбавки", "teachers"),
    ("teacher_salary", "O'qituvchilar ish haqi", "Зарплата учителей", "teachers"),
    ("school_transfer", "Maktabga o'tkazish / qabul", "Перевод / приём в школу", "school"),
    ("school_uniform", "Maktab formasi", "Школьная форма", "school"),
    ("school_textbooks", "Darsliklar va o'quv dasturi", "Учебники и программа", "school"),
    ("school_exams", "Bitiruv imtihonlari", "Выпускные экзамены", "school"),
    ("preschool", "Maktabgacha ta'lim (bog'cha)", "Дошкольное образование", "preschool"),
    ("appeals_procedure", "Murojaat tartibi va muddatlari", "Порядок рассмотрения обращений", "appeals"),
    ("corruption", "Korrupsiya va firibgarlik", "Коррупция и мошенничество", "security"),
    ("other", "Boshqa", "Другое", "appeals"),
]

REGIONS = [
    "Toshkent shahri", "Toshkent viloyati", "Andijon", "Buxoro", "Farg'ona", "Jizzax", "Xorazm", "Namangan",
    "Navoiy", "Qashqadaryo", "Qoraqalpog'iston", "Samarqand", "Sirdaryo", "Surxondaryo",
]

DEMO_STAFF = [  # username, password, full name, role, department code
    ("operator", "operator123", "Demo Operator", "operator", "appeals"),
    ("specialist", "specialist123", "Demo Mutaxassis (Oliy ta'lim)", "specialist", "higher_ed"),
    ("teachers", "teachers123", "Demo Mutaxassis (Attestatsiya)", "specialist", "teachers"),
    ("manager", "manager123", "Demo Rahbar", "manager", None),
    ("kbadmin", "kbadmin123", "Demo Bilim bazasi admini", "kb_admin", None),
]


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    await seed()


async def seed() -> None:
    from app.api.auth import hash_password

    async with session_scope() as s:
        if (await s.execute(select(Department).limit(1))).scalar():
            return
        deps = {code: Department(code=code, name=name) for code, name in DEPARTMENTS}
        s.add_all(deps.values())
        await s.flush()
        s.add_all(Topic(code=c, name_uz=uz, name_ru=ru, department_id=deps[d].id) for c, uz, ru, d in TOPICS)
        s.add_all(
            Staff(username=u, password_hash=hash_password(p), full_name=n, role=r,
                  department_id=deps[d].id if d else None)
            for u, p, n, r, d in DEMO_STAFF
        )


def _db_dep():
    from fastapi import Depends
    return Depends(get_session, scope="function")


DB = _db_dep()   # use as `s: AsyncSession = DB` in endpoints
