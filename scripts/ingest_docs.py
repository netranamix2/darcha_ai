"""Chunk + embed + store all documents of a folder (described in its meta.yaml).

    python scripts/ingest_docs.py data/documents
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db.session import init_db, session_scope  # noqa: E402
from app.kb.ingest import ingest_folder  # noqa: E402


async def main(folder: str) -> None:
    await init_db()
    async with session_scope() as s:
        results = await ingest_folder(s, Path(folder))
    print(f"\n{len(results)} documents, {sum(n for _, n in results)} chunks indexed.")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "data/documents"))
