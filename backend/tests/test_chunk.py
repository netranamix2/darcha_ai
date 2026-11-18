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


def test_appendix_points_are_cited_with_appendix():
    text = """Vazirlar Mahkamasining qarori
1. 1-ilovaga muvofiq Nizom tasdiqlansin.
2. 2-ilovaga muvofiq Nizom tasdiqlansin.
1-ilova. Qabul tartibi to'g'risida Nizom
1-bob. Umumiy qoidalar
1. Qabul har yili test sinovlari asosida o'tkaziladi.
2. Hujjatlar onlayn qabul qilinadi.
2-ilova. O'qishni ko'chirish tartibi to'g'risida Nizom
1-bob. Umumiy qoidalar
1. Ko'chirish yiliga ikki marta amalga oshiriladi.
2. Ariza vazirlik sayti orqali beriladi.
"""
    from app.kb.chunk import chunk_document
    refs = [p.article_ref for p in chunk_document(text, "Qaror 578")]
    assert "1-band" in refs                      # point 1 of the decree itself
    assert "1-ilova, 1-band" in refs and "2-ilova, 1-band" in refs
    p = next(p for p in chunk_document(text, "Qaror 578") if p.article_ref == "2-ilova, 2-band")
    assert "2-ilova: O'qishni ko'chirish" in p.header and "1-bob" in p.header


def test_explicit_nested_appendix_marker():
    from app.kb.chunk import chunk_document
    text = """§ILOVA 1-ilova | Akademik ta'til berish to'g'risida nizom
1. Akademik ta'til tibbiy ko'rsatmalar bo'yicha beriladi.
2. Ta'til muddati bir yilgacha.
§ILOVA 1-ilovaga 1-ilova | Kasalliklar ro'yxati
1. Sil kasalligining faol shakli va boshqa og'ir kasalliklar.
2. Qon bosimining xavfli darajada oshishi.
"""
    refs = [p.article_ref for p in chunk_document(text, "Qaror 344")]
    assert refs == ["1-ilova, 1-band", "1-ilova, 2-band", "1-ilovaga 1-ilova, 1-band", "1-ilovaga 1-ilova, 2-band"]


def test_single_faq_pair_is_chunked_as_faq():
    from app.kb.chunk import chunk_document
    ps = chunk_document("S: Kontraktni bo'lib to'lash mumkinmi?\nJ: Ha, to'rt bosqichda. Asos: 2431-5, 22-band.\n", "FAQ")
    assert len(ps) == 1 and ps[0].article_ref == "FAQ" and "Kontraktni" in ps[0].header
