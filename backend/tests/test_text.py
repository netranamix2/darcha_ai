from app.kb.translit import cyr_to_lat, guess_language, lat_to_cyr, mask_pii, to_search_form
from app.pipeline.normalize import normalize
from app.pipeline.retrieve import keyword_query


def test_translit_roundtrip_words():
    assert cyr_to_lat("Ўқишни кўчириш") == "O'qishni ko'chirish"
    assert lat_to_cyr("o'qishni ko'chirish") == "ўқишни кўчириш"
    assert cyr_to_lat("Ёшлар ерга") == "Yoshlar yerga"


def test_search_form_unifies_scripts_and_apostrophes():
    assert to_search_form("Ўқишни") == to_search_form("O‘qishni") == to_search_form("oʻqishni") == "o'qishni"


def test_language_detection():
    assert guess_language("Как перевести ребенка в другую школу?") == "ru"
    assert guess_language("Bolani boshqa maktabga qanday o'tkazsa bo'ladi?") == "uz"
    assert guess_language("Боламни бошқа мактабга қандай ўтказаман") == "uz"
    assert guess_language("perevod qilish mumkinmi, документы kerakmi?") == "mixed"


def test_pii_masking_and_phone_hash():
    masked, found = mask_pii("Tel +998 90 123-45-67, JShShIR 31234567890123, AA1234567, karta 8600 1234 5678 9012")
    assert "998" not in masked and "3123456789" not in masked and "AA1234567" not in masked and "8600" not in masked
    n = normalize("raqamim 90 123 45 67")
    assert n.phone_hash and n.phone_hash == normalize("+998901234567").phone_hash


def test_keyword_query_prefixes_uzbek_suffixes():
    q = keyword_query(to_search_form("O'qishni ko'chirish uchun qanday hujjatlar kerak?"))
    assert "oqis:*" in q and "uchun" not in q and "kerak" not in q
