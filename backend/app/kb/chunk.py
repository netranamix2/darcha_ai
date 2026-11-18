"""Structure-aware chunking (section 9): one chunk = one point / article, not N characters.

Every chunk starts with a header "Document title — Chapter — Point N", so the citation
can be taken straight from the chunk.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.kb.translit import normalize_apostrophes

MAX_WORDS = 600   # split longer points into windows
WINDOW_WORDS = 400
OVERLAP_WORDS = 60

_CHAPTER_RE = re.compile(
    r"(?im)^\s*(?:(\d+|[IVXLC]+)\s*[-.]?\s*(?:bob|боб|глава)\b|(?:глава|bob)\s+(\d+|[IVXLC]+))[.:]?\s*(.*)$"
)
_ARTICLE_RE = re.compile(r"(?im)^\s*(\d+)\s*-\s*(?:modda|модда)\b[.:]?.*$|^\s*статья\s+(\d+)\b.*$")
_POINT_RE = re.compile(r"(?m)^\s*(\d{1,3})\.\s+(?=\S)")
_FAQ_Q_RE = re.compile(r"(?im)^\s*(?:S|Q|Savol|Савол|Вопрос)\s*[:.)-]\s*")


@dataclass
class Piece:
    article_ref: str
    header: str
    text: str


def clean(text: str) -> str:
    text = normalize_apostrophes(text).replace("\xa0", " ").replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _windows(text: str) -> list[str]:
    words = text.split()
    if len(words) <= MAX_WORDS:
        return [text]
    out, i = [], 0
    while i < len(words):
        out.append(" ".join(words[i:i + WINDOW_WORDS]))
        i += WINDOW_WORDS - OVERLAP_WORDS
    return out


def _chapters(text: str) -> list[tuple[str, str]]:
    """[(chapter_label, chapter_text)] - a single ('', text) when there are no chapters."""
    ms = list(_CHAPTER_RE.finditer(text))
    if not ms:
        return [("", text)]
    out = []
    if text[: ms[0].start()].strip():
        out.append(("", text[: ms[0].start()]))
    for m, nxt in zip(ms, ms[1:] + [None]):
        num = m.group(1) or m.group(2)
        title = (m.group(3) or "").strip()
        label = f"{num}-bob" + (f". {title}" if title else "")
        out.append((label, text[m.end(): nxt.start() if nxt else len(text)]))
    return out


def _split(text: str) -> list[tuple[str, str]]:
    """Split a chapter body into (ref, body) by articles, else numbered points, else whole."""
    arts = list(_ARTICLE_RE.finditer(text))
    if len(arts) >= 2:
        out = []
        if text[: arts[0].start()].strip():
            out.append(("", text[: arts[0].start()]))
        for m, nxt in zip(arts, arts[1:] + [None]):
            num = m.group(1) or m.group(2)
            out.append((f"{num}-modda", text[m.start(): nxt.start() if nxt else len(text)]))
        return out
    pts = list(_POINT_RE.finditer(text))
    if len(pts) >= 2:
        out = []
        if text[: pts[0].start()].strip():
            out.append(("", text[: pts[0].start()]))
        for m, nxt in zip(pts, pts[1:] + [None]):
            out.append((f"{m.group(1)}-band", text[m.start(): nxt.start() if nxt else len(text)]))
        return out
    return [("", text)]


def chunk_faq(text: str, title: str) -> list[Piece]:
    parts = _FAQ_Q_RE.split(text)
    out = []
    for body in parts[1:]:
        body = body.strip()
        if not body:
            continue
        q = body.split("\n", 1)[0].strip()
        out.append(Piece(article_ref="FAQ", header=f"{title} — FAQ: {q[:150]}", text="S: " + body))
    return out


def chunk_document(text: str, title: str) -> list[Piece]:
    text = clean(text)
    if len(_FAQ_Q_RE.findall(text)) >= 3:
        return chunk_faq(text, title)
    pieces: list[Piece] = []
    for chapter, ch_text in _chapters(text):
        for ref, body in _split(ch_text):
            body = body.strip()
            if not body or len(body) < 20:
                continue
            windows = _windows(body)
            for i, w in enumerate(windows):
                r = ref + (f" ({i + 1}-qism)" if len(windows) > 1 else "")
                header = " — ".join(x for x in [title, chapter, r] if x)
                pieces.append(Piece(article_ref=r or (chapter or "Kirish"), header=header, text=w))
    return pieces
