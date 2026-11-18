"""Download full texts from lex.uz for every document in data/registry.yaml and write the ingest metadata.

    backend/.venv/bin/python scripts/fetch_lex.py            # all documents with a lex.uz link
    backend/.venv/bin/python scripts/fetch_lex.py KB-001     # only these

For each document it:
  * saves the current consolidated text as data/documents/lex/<KB-id>.txt, with appendix markers
    ("3-ilova. Title") so citations read "3-ilova, 14-band";
  * checks lex.uz's own repeal notice ("... asosan o'z kuchini yo'qotgan") at the top of the act;
  * writes data/documents/lex/meta.yaml (repealed / unverified documents are not cited);
  * writes data/documents/lex/_report.md: what was fetched, status changes, what is still missing.

Polite: one request at a time, a pause between them, raw pages cached in data/documents/lex/_cache/.
"""
from __future__ import annotations

import hashlib
import re
import sys
import time
from datetime import date
from pathlib import Path

import httpx
import yaml
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/documents/lex"
CACHE = OUT / "_cache"
UA = "Mozilla/5.0 (X11; Linux x86_64) Darcha-KB-fetcher"
PAUSE_S = 2.0
TEXT_CLASSES = ("ACT_TITLE", "ACT_TEXT", "TEXT_HEADER_DEFAULT", "ACT_FORM", "ACCEPTING_BODY",
                "ACT_ESSENTIAL_ELEMENTS", "ACT_ESSENTIAL_ELEMENTS_NUM", "SIGNATURE", "TABLE_STD", "CLAUSE_DEFAULT",
                "ARTICLE_DEFAULT", "CHAPTER", "SECTION")
REPEAL_RE = re.compile(r"o[ʻ'‘`]z\s+kuchini\s+yo[ʻ'‘`]qotgan|утратил[аио]?\s+силу|lost\s+(its\s+)?force", re.I)


def text_url(url: str) -> str:
    """lex.uz/<lang>/acts/<id> is a viewer page without the text; /docs/<id> has it. Also drop 'www.'."""
    return re.sub(r"lex\.uz/(?:(\w\w)/)?m?acts/", lambda m: f"lex.uz/{m[1] + '/' if m[1] else ''}docs/", url) \
        .replace("://www.lex.uz", "://lex.uz")


def fetch(url: str, key: str) -> str:
    url = text_url(url)
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{key}_{hashlib.sha1(url.encode()).hexdigest()[:10]}.html"   # new URL -> new download
    if path.exists() and path.stat().st_size > 10_000:
        return path.read_text(encoding="utf-8")
    r = httpx.get(url, headers={"User-Agent": UA}, timeout=60, follow_redirects=True)
    r.raise_for_status()
    path.write_text(r.text, encoding="utf-8")
    time.sleep(PAUSE_S)
    return r.text


def _txt(el) -> str:
    for junk in el.select(".lx_elem2, .lx_no_select"):   # per-paragraph toolbar, editorial notes
        junk.decompose()
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()


SUP = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def appendix_label(banner: str, top: str | None) -> tuple[str, bool]:
    """'...578-son qaroriga 3-ILOVA' -> ('3-ilova', False); '...nizomga 2-ILOVA' (an appendix of an appendix)
    -> ('3-ilovaga 2-ilova', True); '...qaroriga 1 1 -ILOVA' (superscript) -> ('1¹-ilova', False)."""
    m = re.search(r"(\d+)(?:\s+(\d+))?\s*-\s*ILOVA|(?<![\w-])ILOVA\b", banner, re.I)
    num = (m[1] + (m[2].translate(SUP) if m[2] else "")) if m and m[1] else "1"
    nested = bool(re.search(r"nizomga|низомга|положению", banner, re.I)) and top is not None
    return (f"{top}ga {num}-ilova" if nested else f"{num}-ilova"), nested


CODE_LINE_RE = re.compile(r"\b\d{2}\.\d{2}\.\d{2}\.\d{2}\b|hujjatlari\]$")
OKOZ_RE = re.compile(r"\[\s*OKOZ:.*?\]", re.S)   # legal classifier codes, not content


def _table_rows(table) -> list[str]:
    """One line per row, cells joined by ' | ' (position lists, scoring tables, payment schedules)."""
    out = []
    for tr in table.find_all("tr"):
        if tr.find_parent("table") is not table:
            continue
        cells = [_txt(td) for td in tr.find_all(["td", "th"], recursive=False)]
        cells = [c for c in cells if c]
        if cells:
            out.append(" | ".join(cells))
    return out


def _fallback_lines(soup) -> list[str]:
    root = soup.select_one("#divCont") or soup.body
    if root is None:
        return []
    for junk in root.select("script, style, .lx_elem2, .lx_no_select"):
        junk.decompose()
    lines = []
    for el in root.find_all(["p", "div", "table"]):
        if el.name == "table":
            if not el.find_parent("table"):
                lines.extend(_table_rows(el))
            continue
        if el.find(["p", "div", "table"]) or el.find_parent("table"):
            continue   # only leaf blocks
        t = re.sub(r"\s+", " ", OKOZ_RE.sub("", el.get_text(" ", strip=True))).strip()
        if not t or t in ("Hujjatga taklif yuborish", "Audioni tinglash", "Hujjat elementidan havola olish"):
            continue
        if CODE_LINE_RE.search(t) or t in ("[", "]") or re.fullmatch(r"\[?\s*(OKOZ|TSZ|TSHK)\s*:?", t):
            continue   # classifier codes ("14.01.00.00 Sog'liqni saqlash ...") would look like numbered points
        lines.append(t)
    # appendix banners ("...qaroriga 2-ILOVA") followed by the appendix title -> explicit markers
    out, top, used, i = [], None, set(), 0
    while i < len(lines):
        t = lines[i]
        if re.search(r"-\s*ILOVA\s*$|(?<![\w-])ILOVA\s*$", t) and i + 1 < len(lines):
            label, nested = appendix_label(t, top)
            if not nested:
                top = label
            while label in used:
                label += "*"
            used.add(label)
            out.append(f"\n§ILOVA {label} | {lines[i + 1]}")
            i += 2
            continue
        out.append(t)
        i += 1
    return out


def parse(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    head = [re.sub(r"\s+", " ", e.get_text(" ", strip=True)) for e in soup.select(".docHeader__item-label")]
    # Repeal notice: a COMMENT block placed before the first paragraph of the act.
    repeal = None
    for el in soup.select(".COMMENT, .ACT_TEXT"):
        if "ACT_TEXT" in el.get("class", []):
            break
        t = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
        if REPEAL_RE.search(t):
            repeal = t[:400]
            break
    lines, pending, top, used = [], None, None, set()
    for el in soup.select(".lx_elem, table"):
        if el.name == "table":
            if el.find_parent("table"):
                continue   # nested tables are read as part of their parent
            lines.extend(_table_rows(el))
            continue
        if el.find("table") or el.find_parent("table"):
            continue   # its text comes from the table rows
        cls = el.get("class", [])
        if "APPL_BANNER_LANDSCAPE_TITLE" in cls or "APPL_BANNER" in cls:
            pending = appendix_label(_txt(el), top)
            if not pending[1]:
                top = pending[0]
            continue
        if "ACT_TITLE_APPL" in cls:
            label = pending[0] if pending else f"{len(used) + 1}-ilova"
            while label in used:   # never two appendices with the same citation label
                label += "*"
            used.add(label)
            lines.append(f"\n§ILOVA {label} | {_txt(el)}")
            pending = None
            continue
        if any(c in cls for c in TEXT_CLASSES):
            t = _txt(el)
            if t:
                lines.append(t)
    if not soup.select(".lx_elem"):
        lines = _fallback_lines(soup)   # e.g. lex.uz/mact/... pages: plain blocks inside #divCont
    title = _txt(soup.select_one(".ACT_TITLE")) if soup.select_one(".ACT_TITLE") else ""
    return {"header": head, "title": title, "repeal": repeal, "text": "\n".join(lines).strip()}


def main(only: list[str]) -> None:
    registry = yaml.safe_load((ROOT / "data/registry.yaml").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    meta_path = OUT / "meta.yaml"
    old_meta = {m["file"]: m for m in (yaml.safe_load(meta_path.read_text(encoding="utf-8")) or [])} \
        if meta_path.exists() else {}
    report, metas = [], dict(old_meta)
    for d in registry:
        if only and d["id"] not in only:
            continue
        if not d.get("lex_url"):
            if d["status"] in ("active", "check", "temporary"):
                report.append(f"| {d['id']} | {d['number'] or '?'} | — | **no lex.uz link** — find it manually | |")
            continue
        try:
            p = parse(fetch(d["lex_url"], d["id"]))
        except Exception as e:   # network / HTTP error: report, keep going
            report.append(f"| {d['id']} | {d['number']} | {d['lex_url']} | fetch failed: {e} | |")
            continue
        words = len(p["text"].split())
        on_lex = "repealed" if p["repeal"] else "no repeal notice"
        if d["status"] == "repealed":
            status, ingest = "repealed", False
        elif p["repeal"]:
            status, ingest = "repealed", False
        elif d["status"] in ("active", "check", "temporary"):
            status, ingest = "active", True
        else:
            status, ingest = d["status"], False
        if words < 80:
            ingest = False   # an empty or broken page must not become a "document"
        file = f"{d['id']}.txt"
        (OUT / file).write_text(p["text"] + "\n", encoding="utf-8")
        meta = {"file": file, "kb_id": d["id"], "title": d["title"], "number": d["number"] or None,
                "issued_at": d["issued_at"], "status": status, "source_url": text_url(d["lex_url"]), "lang": "uz",
                "doc_type": "regulation", "ingest": ingest,
                "lex_check": f"{date.today().isoformat()}: lex.uz says {on_lex}; sheet said {d['status']}"}
        if d.get("valid_until"):
            meta["valid_until"] = d["valid_until"]
        metas[file] = meta
        change = "" if (d["status"] == "check") is False and (status == d["status"]) else \
            f"{d['status']} → **{status}**"
        note = f"{words} words" + ("" if ingest else " — NOT indexed")
        report.append(f"| {d['id']} | {d['number']} | {d['lex_url']} | {on_lex}; {note} | {change} |")
        print(f"  {d['id']:7s} {str(d['number'])[:14]:14s} {on_lex:16s} {words:6d} words  {change}")
    meta_path.write_text(
        "# Generated by scripts/fetch_lex.py from data/registry.yaml. ingest: false = kept for the record, never cited.\n"
        + yaml.safe_dump(list(metas.values()), allow_unicode=True, sort_keys=False, width=200), encoding="utf-8")
    (OUT / "_report.md").write_text(
        f"# lex.uz fetch report ({date.today().isoformat()})\n\n| KB | Number | URL | lex.uz | Status change |\n"
        "|---|---|---|---|---|\n" + "\n".join(report) + "\n", encoding="utf-8")
    print(f"\n{len(report)} rows -> {OUT / '_report.md'}")


if __name__ == "__main__":
    main(sys.argv[1:])
