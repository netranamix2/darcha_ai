"""Find lex.uz links for registry documents that have none (or only a news-site link).

    backend/.venv/bin/python scripts/find_lex.py            # all documents without a lex.uz link
    backend/.venv/bin/python scripts/find_lex.py --apply    # also write confirmed links into data/registry.yaml

Searches lex.uz by title keywords and accepts a result only when BOTH the number and the date match
the registry. Everything else is listed as a candidate for a person to confirm - never written.
"""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import httpx
import yaml
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (X11; Linux x86_64) Darcha-KB-fetcher"

# Title keywords to search for (lex.uz searches titles; avoid apostrophes, they are spelled differently).
QUERIES = {
    "KB-005": ["pedagog xodimlarining farzandlari", "pedagog farzandlari", "to'lov-kontrakt chegirma"],
    "KB-006": ["pedagog kadrlarini attestatsiyadan", "attestatsiya", "pedagog kadrlarini"],
    "KB-012": ["Ta'lim va fan vazirligi faoliyatini tashkil etish", "vazirligi faoliyatini tashkil etish"],
    "KB-013": ["Ta'lim va fan vazirligini tashkil etish", "fan vazirligini tashkil", "fan vazirligi", "vazirligini tashkil"],
    "KB-018": ["talabalar turar joy", "yotoqxona", "turar joylarida yashash xarajatlari"],
    "KB-019": ["ikkinchi va undan keyingi oliy"],
    "KB-020": ["kredit-modul tizimi", "kredit-modul", "ta'lim jarayonini tashkil etish", "kredit"],
    "KB-027": ["grantlarni qayta taqsimlash", "davlat grantlari asosida qayta taqsimlash"],
    "KB-030": ["tibbiyot xodimlarining farzandlari", "tibbiyot xodimlari farzandlari", "tibbiyot", "subsidiya"],
    "KB-034": ["pedagogik lavozimlar", "pedagog lavozimlari ro'yxati", "lavozimlari", "pedagogik"],
    "KB-038": ["ilmiy darajalarni tan olish", "xorijda olingan ilmiy"],
}
ROW_RE = re.compile(r"(\d{2}\.\d{2}\.\d{4})\s+yildagi\s+(?:№\s*)?([\w-]+?)-son|(\d{2}\.\d{2}\.\d{4})\s+yildagi\s+(\d+)", re.I)


def search(q: str) -> list[dict]:
    url = f"https://lex.uz/uz/search/nat?searchtitle={quote(q)}"
    r = httpx.get(url, headers={"User-Agent": UA}, timeout=60, follow_redirects=True)
    time.sleep(2.0)
    soup = BeautifulSoup(r.text, "html.parser")
    out = []
    for a in soup.select('a[href*="/docs/"]'):
        m = re.search(r"/docs/(-?\d+)", a["href"])
        if not m:
            continue
        row = a
        for _ in range(4):
            row = row.parent or row
        text = re.sub(r"\s+", " ", row.get_text(" ", strip=True))
        dm = ROW_RE.search(text)
        out.append({"url": f"https://lex.uz/uz/docs/{m[1]}", "title": a.get_text(" ", strip=True)[:160],
                    "date": dm and (dm[1] or dm[3]), "number": dm and (dm[2] or dm[4]), "row": text[:300]})
    return out


def digits(s) -> str:
    return re.sub(r"\D", "", str(s or ""))


def main(apply: bool) -> None:
    reg_path = ROOT / "data/registry.yaml"
    head = "".join(line for line in reg_path.read_text(encoding="utf-8").splitlines(keepends=True) if line.startswith("#"))
    registry = yaml.safe_load(reg_path.read_text(encoding="utf-8"))
    report = []
    for d in registry:
        if d["id"] not in QUERIES:
            continue
        want_num, want_date = digits(d["number"]), d.get("issued_at")
        want_date_dmy = "-".join(reversed(want_date.split("-"))).replace("-", ".") if want_date else None
        seen, confirmed, candidates = set(), None, []
        for q in QUERIES[d["id"]]:
            for r in search(q):
                if r["url"] in seen:
                    continue
                seen.add(r["url"])
                num_ok = want_num and digits(r["number"]) == want_num
                date_ok = want_date_dmy and r["date"] == want_date_dmy
                if num_ok and date_ok:
                    confirmed = r
                    break
                if num_ok or date_ok:
                    candidates.append(r)
            if confirmed:
                break
        if confirmed:
            line = f"| {d['id']} | {d['number']} | ✅ {confirmed['url']} | number + date match |"
            if apply:
                d["source_url_news"] = d.get("source_url") if d.get("source_url") != confirmed["url"] else None
                d["lex_url"] = d["source_url"] = confirmed["url"]
                d["lex_url_found_by"] = "scripts/find_lex.py (number + date match)"
        elif candidates:
            c = "; ".join(f"{x['url']} ({x['number']}, {x['date']})" for x in candidates[:3])
            line = f"| {d['id']} | {d['number']} | candidates: {c} | **confirm by hand** |"
        else:
            line = f"| {d['id']} | {d['number']} | not found by title search | find by hand |"
        print(line)
        report.append(line)
    if apply:
        reg_path.write_text(head + yaml.safe_dump(registry, allow_unicode=True, sort_keys=False, width=200),
                            encoding="utf-8")
    out = ROOT / "data/documents/lex/_find_report.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("| KB | Number | lex.uz | Result |\n|---|---|---|---|\n" + "\n".join(report) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main("--apply" in sys.argv)
