from app.kb.chunk import chunk_document

LAW = """I bob. Umumiy qoidalar
1. Ushbu Nizom o'qishni ko'chirish tartibini belgilaydi.
2. Ko'chirish talabaning arizasi asosida amalga oshiriladi.
II bob. Hujjatlar
3. Ariza va akademik ma'lumotnoma taqdim etiladi.
4. Hujjatlar 10 kun ichida ko'rib chiqiladi.
"""


def test_points_and_chapters():
    pieces = chunk_document(LAW, "Ko'chirish Nizomi")
    refs = [p.article_ref for p in pieces]
    assert refs == ["1-band", "2-band", "3-band", "4-band"]
    assert pieces[2].header.startswith("Ko'chirish Nizomi — II-bob. Hujjatlar — 3-band")


def test_articles():
    text = "1-modda. Maqsad\nMatn bir.\n2-modda. Asosiy tushunchalar\nMatn ikki uzunroq.\n"
    assert [p.article_ref for p in chunk_document(text, "Qonun")] == ["1-modda", "2-modda"]


def test_faq():
    text = "S: Savol bir?\nJ: Javob.\nS: Savol ikki?\nJ: Javob.\nS: Savol uch?\nJ: Javob."
    pieces = chunk_document(text, "FAQ")
    assert len(pieces) == 3 and all(p.article_ref == "FAQ" for p in pieces)
