"""Draft "key points" for registry documents that have a downloaded text but no key points.

    backend/.venv/bin/python scripts/key_points.py KB-008 KB-017 ...

Writes them into data/registry.yaml marked "черновик (Claude) — проверить", so the team reviews them.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.llm.client import complete_json  # noqa: E402

SCHEMA = {"type": "object", "properties": {"points": {"type": "array", "items": {"type": "string"}}},
          "required": ["points"], "additionalProperties": False}
MAX_WORDS = 15000   # long acts: the start (decree + main regulation) carries most of what citizens ask


async def main(ids: list[str]) -> None:
    p = ROOT / "data/registry.yaml"
    raw = p.read_text(encoding="utf-8")
    head = "".join(line for line in raw.splitlines(keepends=True) if line.startswith("#"))
    reg = yaml.safe_load(raw)
    for d in reg:
        if d["id"] not in ids:
            continue
        f = ROOT / "data/documents/lex" / f"{d['id']}.txt"
        if not f.exists():
            print(f"  {d['id']}: no text downloaded, skipped")
            continue
        text = " ".join(f.read_text(encoding="utf-8").split(" ")[:MAX_WORDS])
        r = await complete_json("key_points", SCHEMA, max_tokens=2000, title=d["title"], number=d["number"],
                                date=d["issued_at"], text=text)
        pts = [x if x.startswith("•") else f"• {x}" for x in r["points"]]
        d["key_points"] = "\n".join(pts)
        d["key_points_source"] = "черновик (Claude, по тексту lex.uz) — проверить"
        print(f"  {d['id']}: {len(pts)} points")
    p.write_text(head + yaml.safe_dump(reg, allow_unicode=True, sort_keys=False, width=200), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
