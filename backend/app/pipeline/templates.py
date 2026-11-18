"""Fixed (non-generated) replies, in the citizen's language and script."""
from __future__ import annotations

import re
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
    # ---- fixed refusals (level "gray"): firm, polite, no AI-generated text
    "personal_data_request": {
        "uz": "Kechirasiz, boshqa shaxslarning shaxsiy ma'lumotlarini (manzil, telefon, pasport va h.k.) bera olmayman — "
              "ular qonun bilan himoyalangan. Ta'lim bo'yicha savolingiz bo'lsa, yordam beraman.",
        "ru": "Извините, я не предоставляю персональные данные других людей (адрес, телефон, паспорт и т. п.) — "
              "они защищены законом. Если у вас вопрос об образовании, с радостью помогу.",
    },
    "forgery": {
        "uz": "Bunda yordam bera olmayman: hujjatlarni soxtalashtirish qonunga ziddir. Haqiqiy ma'lumotnoma yoki "
              "hujjatni o'qish joyingiz yoki my.gov.uz orqali rasmiy tartibda olishingiz mumkin.",
        "ru": "С этим помочь не могу: подделка документов противозаконна. Настоящую справку или документ можно "
              "получить официально — в учебном заведении или через my.gov.uz.",
    },
    "cheating": {
        "uz": "Bunda yordam bera olmayman — bu akademik halollik qoidalariga zid. Imtihon yoki ish tartibi, "
              "qayta topshirish va tayyorgarlik bo'yicha savollaringizga javob beraman.",
        "ru": "С этим помочь не могу — это нарушает правила академической честности. Могу ответить на вопросы "
              "о порядке экзаменов, пересдачах и подготовке.",
    },
    "defamation": {
        "uz": "Men shaxslar haqida ayblov yoki baho bildirmayman. Agar biror mansabdor shaxsning qonunbuzarligi "
              "haqida ma'lumotingiz bo'lsa, rasmiy murojaat yuboring yoki ishonch telefoniga qo'ng'iroq qiling: {hotlines}.",
        "ru": "Я не делаю заявлений и оценок о конкретных людях. Если у вас есть сведения о нарушениях со стороны "
              "должностного лица, направьте официальное обращение или позвоните на телефон доверия: {hotlines}.",
    },
    "harmful_request": {
        "uz": "Bunday matn yoza olmayman. Agar o'qishingiz bo'yicha muammo bo'lsa (baho, sinov, dekanat qarori), "
              "uni qanday rasmiy hal qilish mumkinligini tushuntirib beraman.",
        "ru": "Такой текст я написать не могу. Если у вас проблема с учёбой (оценка, зачёт, решение деканата), "
              "подскажу, как решить её официальным путём.",
    },
    "political": {
        "uz": "Men siyosiy mavzularda fikr bildirmayman. Ta'lim bo'yicha savollaringizga javob beraman: qabul, "
              "o'qishni ko'chirish, kontrakt, attestatsiya va boshqalar.",
        "ru": "Я не обсуждаю политические темы. Отвечу на вопросы об образовании: приём, перевод, контракт, "
              "аттестация и другие.",
    },
    "insult_calm": {
        "uz": "Tushunaman, javobim sizga yoqmagan bo'lishi mumkin. Savolingizni boshqacha yozib ko'ring — "
              "yordam berishga harakat qilaman.",
        "ru": "Понимаю, мой ответ мог вас не устроить. Попробуйте сформулировать вопрос иначе — постараюсь помочь.",
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


SOURCES_LABEL = {("uz", "latin"): "📚 Asos", ("uz", "cyrillic"): "📚 Асос", ("ru", "cyrillic"): "📚 Основание",
                 ("ru", "latin"): "📚 Основание"}


def format_sources(citations: list[dict], lang: str | None, script: str | None) -> str:
    """Plain-text sources block; chat adapters may render it richer (Telegram: clickable titles).
        📚 Asos:
        • <document title> — <point>
          <url>"""
    label = SOURCES_LABEL.get((lang or "uz", script or "latin"), "📚 Asos")
    lines, seen = [f"{label}:"], set()
    for c in citations:
        key = (c.get("title"), c.get("ref"))
        if key in seen:
            continue
        seen.add(key)
        title = (c.get("title") or "").strip()
        m = re.search(r"№\s*(\S+)\s*$", title)
        number = m[1] if m else None
        is_faq = title.startswith("Tez-tez beriladigan savollar")
        if lang != "ru" and number:   # titles in the registry are Russian; show a neutral label to Uzbek readers
            cyr = script == "cyrillic"
            title = (f"Расмий савол-жавоблар (№{number})" if cyr else f"Rasmiy savol-javoblar (№{number})") if is_faq \
                else (f"№{number}-сон ҳужжат" if cyr else f"№{number}-son hujjat")
        elif is_faq:
            title = "Официальные вопросы-ответы — " + title.split("—", 1)[-1].strip()
        title = title if len(title) <= 90 else title[:87].rstrip() + "…"
        ref = (c.get("ref") or "").strip()
        show_ref = ref and ref not in title and ref.upper() != "FAQ"
        lines.append(f"• {title}" + (f" — {ref}" if show_ref else ""))
        if c.get("url"):
            lines.append(f"  {c['url']}")
        if len(seen) == 3:
            break
    return "\n".join(lines)
