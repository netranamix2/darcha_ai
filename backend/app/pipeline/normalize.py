from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field

from app.kb.translit import detect_script, guess_language, mask_pii, to_search_form


@dataclass
class Normalized:
    text_raw: str
    text_masked: str
    text_latin: str
    lang: str          # uz | ru | mixed
    script: str        # latin | cyrillic
    pii: dict = field(default_factory=dict)

    @property
    def phone_hash(self) -> str | None:
        phones = self.pii.get("[TELEFON]")
        if not phones:
            return None
        digits = re.sub(r"\D", "", phones[0])[-9:]   # last 9 digits = number without +998
        return hashlib.sha256(digits.encode()).hexdigest()


def normalize(text: str) -> Normalized:
    raw = text.strip()
    masked, found = mask_pii(raw)
    return Normalized(
        text_raw=raw,
        text_masked=masked,
        text_latin=to_search_form(masked),
        lang=guess_language(masked),
        script=detect_script(masked),
        pii=found,
    )
