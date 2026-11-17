"""Uzbek text utilities: script/language detection, apostrophe normalisation,
Latin <-> Cyrillic transliteration, numbers -> words, and personal-data masking.

Everything is normalised to Latin with a plain apostrophe before search, so
"Грант", "grant" and "o‘qish"/"o'qish"/"oʻqish" all match.
"""
from __future__ import annotations

import re

# --- apostrophes -------------------------------------------------------------
_APOSTROPHES = "ʻʼ‘’`´ʹ′"
_APOS_RE = re.compile(f"[{_APOSTROPHES}]")


def normalize_apostrophes(text: str) -> str:
    return _APOS_RE.sub("'", text)


# --- script detection --------------------------------------------------------
_CYR_RE = re.compile(r"[Ѐ-ӿ]")
_LAT_RE = re.compile(r"[A-Za-z]")
_RU_ONLY = set("ыщьэЫЩЬЭ")  # letters used in Russian but not (or rarely) in Uzbek Cyrillic
_UZ_CYR_ONLY = set("ўқғҳЎҚҒҲ")


def detect_script(text: str) -> str:
    """Return 'cyrillic' or 'latin' (whichever dominates)."""
    cyr = len(_CYR_RE.findall(text))
    lat = len(_LAT_RE.findall(text))
    return "cyrillic" if cyr > lat else "latin"


_RU_WORDS = {"как", "что", "где", "когда", "можно", "нужно", "почему", "мой", "моя", "мне", "ребенка", "ребёнка",
             "перевод", "перевести", "документы", "здравствуйте", "пожалуйста", "это", "или", "для", "не", "в", "на"}
_UZ_WORDS = {"qanday", "qachon", "qayer", "mumkinmi", "kerak", "uchun", "bilan", "menga", "nima", "assalomu",
             "қандай", "қачон", "мумкинми", "керак", "учун", "билан", "нима", "ассалому", "ва", "бу", "va", "bu"}


def guess_language(text: str) -> str:
    """'uz', 'ru' or 'mixed' (Uzbek and Russian words in one message)."""
    words = set(re.findall(r"[\w']+", normalize_apostrophes(text).lower()))
    chars = set(text)
    ru = bool(words & _RU_WORDS) or bool(chars & _RU_ONLY)
    uz = bool(words & _UZ_WORDS) or bool(chars & _UZ_CYR_ONLY) or detect_script(text) == "latin"
    if ru and uz:
        return "mixed"
    if ru:
        return "ru"
    return "uz"


# --- Cyrillic -> Latin ------------------------------------------------------
_C2L = {
    "а": "a", "б": "b", "в": "v", "г": "g", "ғ": "g'", "д": "d", "ж": "j", "з": "z",
    "и": "i", "й": "y", "к": "k", "қ": "q", "л": "l", "м": "m", "н": "n", "о": "o",
    "ў": "o'", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "x",
    "ҳ": "h", "ч": "ch", "ш": "sh", "ъ": "'", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    "ё": "yo", "ц": "s", "щ": "sh", "ы": "i",
}
_VOWELS_CYR = set("аеёиоуўэюяы")


def cyr_to_lat(text: str) -> str:
    out = []
    for i, ch in enumerate(text):
        low = ch.lower()
        prev = text[i - 1].lower() if i > 0 else " "
        if low == "е":
            # "е" at word start or after a vowel/ъ is "ye", otherwise "e"
            rep = "ye" if (not prev.isalpha() or prev in _VOWELS_CYR or prev == "ъ") else "e"
        elif low == "ц":
            rep = "s" if not prev.isalpha() else "ts"
        elif low in _C2L:
            rep = _C2L[low]
        else:
            out.append(ch)
            continue
        if ch.isupper() and rep:
            nxt = text[i + 1] if i + 1 < len(text) else " "
            rep = rep.upper() if (nxt.isupper() and len(rep) > 1) else rep[0].upper() + rep[1:]
        out.append(rep)
    return "".join(out)


# --- Latin -> Cyrillic -----------------------------------------------------
_L2C_DIGRAPHS = [
    ("o'", "ў"), ("g'", "ғ"), ("sh", "ш"), ("ch", "ч"), ("yo", "ё"), ("yu", "ю"),
    ("ya", "я"), ("ye", "е"),
]
_L2C = {
    "a": "а", "b": "б", "d": "д", "f": "ф", "g": "г", "h": "ҳ", "i": "и", "j": "ж",
    "k": "к", "l": "л", "m": "м", "n": "н", "o": "о", "p": "п", "q": "қ", "r": "р",
    "s": "с", "t": "т", "u": "у", "v": "в", "x": "х", "y": "й", "z": "з", "c": "с",
    "w": "в", "'": "ъ",
}


def lat_to_cyr(text: str) -> str:
    text = normalize_apostrophes(text)
    out = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        pair = text[i:i + 2].lower()
        prev = text[i - 1] if i > 0 else " "
        word_start = not prev.isalpha() and prev != "'"
        rep = None
        for lat, cyr in _L2C_DIGRAPHS:
            if pair == lat:
                rep, step = cyr, 2
                break
        if rep is None:
            low = ch.lower()
            if low == "e":
                rep = "э" if word_start else "е"
            elif low == "'" and not (prev.isalpha()):
                out.append(ch)  # quote mark, not tutuq belgisi
                i += 1
                continue
            elif low in _L2C:
                rep = _L2C[low]
            else:
                out.append(ch)
                i += 1
                continue
            step = 1
        if ch.isupper():
            rep = rep.upper()
        out.append(rep)
        i += step
    return "".join(out)


def to_search_form(text: str) -> str:
    """Canonical form used for indexing and retrieval: Latin, lowercase, plain apostrophes."""
    text = normalize_apostrophes(text)
    if _CYR_RE.search(text):
        text = cyr_to_lat(text)
    return text.lower()


# --- numbers -> Uzbek words (TTS cannot read digits) ------------------------
_ONES = ["nol", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz"]
_TENS = ["", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to'qson"]
_SCALES = [(10**9, "milliard"), (10**6, "million"), (1000, "ming")]


def number_to_words(n: int) -> str:
    if n == 0:
        return "nol"
    if n < 0:
        return "minus " + number_to_words(-n)
    parts = []
    for value, name in _SCALES:
        if n >= value:
            parts.append(f"{number_to_words(n // value)} {name}")
            n %= value
    if n >= 100:
        h = n // 100
        parts.append(("yuz" if h == 1 else f"{_ONES[h]} yuz"))
        n %= 100
    if n >= 10:
        parts.append(_TENS[n // 10])
        n %= 10
    if n > 0:
        parts.append(_ONES[n])
    return " ".join(parts)


def spell_numbers(text: str) -> str:
    return re.sub(r"\d+", lambda m: number_to_words(int(m.group())), text)


# --- personal data masking (before anything leaves the server) --------------
_PII_PATTERNS = [  # order matters: longest digit runs first
    (re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"), "[KARTA]"),  # bank card
    (re.compile(r"\b\d{14}\b"), "[JShShIR]"),                         # PINFL / JShShIR
    (re.compile(r"\b[A-ZА-Я]{2}\s?\d{7}\b"), "[PASPORT]"),             # passport series + number
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "[EMAIL]"),
    (re.compile(r"(\+?998[\s-]?)?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b"), "[TELEFON]"),
]


def mask_pii(text: str) -> tuple[str, dict[str, list[str]]]:
    """Replace personal identifiers with placeholders.

    Returns (masked_text, found) where found maps label -> original values (kept server-side only,
    e.g. to store a phone hash). Names (FIO) are not masked by regex; see README "known limits".
    """
    found: dict[str, list[str]] = {}

    def sub(label):
        def _r(m):
            found.setdefault(label, []).append(m.group(0))
            return label
        return _r

    for pattern, label in _PII_PATTERNS:
        text = pattern.sub(sub(label), text)
    return text, found
