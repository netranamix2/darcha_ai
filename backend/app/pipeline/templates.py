"""Fixed (non-generated) replies, in the citizen's language and script."""
from __future__ import annotations

from datetime import datetime

from app.config import HOTLINES
from app.kb.translit import lat_to_cyr

T = {
    "ticket": {
        "uz": "Murojaatingiz qabul qilindi va mutaxassisga yuborildi. Raqami: {number}. Javob muddati: {due}. "
              "Javob shu yerga keladi.",
        "ru": "Ваше обращение принято и передано специалисту. Номер: {number}. Срок ответа: {due}. "
              "Ответ придёт сюда же.",
    },
    "ticket_public": {
        "uz": "Rahmat, murojaatingiz mutaxassisga yuborildi (№{number}). Shaxsiy ma'lumotlarni bu yerda yozmang — "
              "batafsil ma'lumot uchun botga shaxsiy xabar yozing.",
        "ru": "Спасибо, обращение передано специалисту (№{number}). Не пишите личные данные публично — "
              "для подробностей напишите боту в личные сообщения.",
    },
    "holding": {
        "uz": "Savolingiz qabul qilindi. Mutaxassis javobni tayyorlamoqda, javob shu yerga keladi.",
        "ru": "Вопрос принят. Специалист готовит ответ, он придёт сюда же.",
    },
    "fraud": {
        "uz": "⚠️ Diqqat! Oliy ta'lim muassasasiga qabul, o'qishni ko'chirish yoki diplom pul evaziga amalga "
              "oshirilmaydi. Bunday takliflar — firibgarlik. Pul o'tkazmang va shaxsiy ma'lumotlaringizni bermang. "
              "Ishonch telefoni: {hotlines}. Xabar mas'ul xodimga yuborildi.",
        "ru": "⚠️ Внимание! Поступление, перевод или диплом не продаются за деньги. Такие предложения — "
              "мошенничество. Не переводите деньги и не передавайте личные данные. Телефон доверия: {hotlines}. "
              "Сообщение передано ответственному сотруднику.",
    },
    "violence": {
        "uz": "Xabaringiz uchun rahmat. U zudlik bilan mas'ul xodimga yuborildi. Agar hayot yoki sog'liqqa xavf "
              "bo'lsa, darhol 102 (militsiya) yoki 103 (tez yordam) raqamiga qo'ng'iroq qiling.",
        "ru": "Спасибо за сообщение, оно срочно передано ответственному сотруднику. Если есть угроза жизни или "
              "здоровью, немедленно звоните 102 (полиция) или 103 (скорая помощь).",
    },
    "off_topic": {
        "uz": "Men faqat ta'lim tizimiga oid savollarga javob beraman: qabul, o'qishni ko'chirish, kontrakt, "
              "attestatsiya va boshqalar. Savolingizni shu mavzuda yozing.",
        "ru": "Я отвечаю только на вопросы о системе образования: приём, перевод, контракт, аттестация и другие. "
              "Пожалуйста, задайте вопрос по этой теме.",
    },
    "gratitude": {
        "uz": "Rahmat! Yana savollaringiz bo'lsa, yozing.",
        "ru": "Спасибо! Если появятся вопросы — пишите.",
    },
}


def render(key: str, lang: str, script: str, **kw) -> str:
    kw.setdefault("hotlines", HOTLINES)
    if "due" in kw and isinstance(kw["due"], datetime):
        kw["due"] = kw["due"].strftime("%d.%m.%Y")
    text = T[key]["ru" if lang == "ru" else "uz"].format(**kw)
    if lang != "ru" and script == "cyrillic":
        text = lat_to_cyr(text)
    return text
