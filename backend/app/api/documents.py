"""Knowledge-base administration: list, upload, reindex, repeal."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require
from app.config import DATA_DIR
from app.db.models import Chunk, Document, Staff
from app.db.session import DB
from app.kb.ingest import ingest_text, read_file, reindex

router = APIRouter(prefix="/api/documents", tags=["documents"])
ADMIN = require("kb_admin")


def _doc(d: Document, n: int | None = None) -> dict:
    return {"id": d.id, "title": d.title, "number": d.number, "issued_at": d.issued_at, "status": d.status,
            "doc_type": d.doc_type, "source_url": d.source_url, "lang": d.lang, "file": d.file, "chunks": n}


@router.get("")
async def list_documents(staff: Staff = Depends(require("kb_admin", "operator", "specialist", "manager")),
                         s: AsyncSession = DB):
    counts = dict((await s.execute(select(Chunk.document_id, func.count()).group_by(Chunk.document_id))).all())
    docs = (await s.execute(select(Document).order_by(Document.id))).scalars().all()
    return [_doc(d, counts.get(d.id, 0)) for d in docs]


@router.get("/{doc_id}/chunks")
async def document_chunks(doc_id: int, staff: Staff = Depends(require("kb_admin", "operator", "specialist", "manager")),
                          s: AsyncSession = DB):
    rows = (await s.execute(select(Chunk).where(Chunk.document_id == doc_id).order_by(Chunk.id))).scalars().all()
    return [{"id": c.id, "article_ref": c.article_ref, "header": c.header, "text": c.text} for c in rows]


@router.post("")
async def upload(file: UploadFile = File(...), title: str = Form(...), number: str | None = Form(None),
                 issued_at: str | None = Form(None), source_url: str | None = Form(None),
                 lang: str | None = Form(None), doc_type: str = Form("regulation"),
                 staff: Staff = Depends(ADMIN), s: AsyncSession = DB):
    name = re.sub(r"[^\w.\-]+", "_", file.filename or "upload.txt")
    folder = DATA_DIR / "documents" / "uploads"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / name
    path.write_bytes(await file.read())
    text = read_file(path)
    if not text.strip():
        raise HTTPException(422, "no text could be extracted from the file")
    doc, n = await ingest_text(s, text, {"file": f"uploads/{name}", "title": title, "number": number,
                                         "issued_at": issued_at, "source_url": source_url, "lang": lang,
                                         "doc_type": doc_type, "status": "active"})
    return _doc(doc, n)


@router.post("/{doc_id}/reindex")
async def reindex_document(doc_id: int, staff: Staff = Depends(ADMIN), s: AsyncSession = DB):
    doc = await s.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "document not found")
    return _doc(doc, await reindex(s, doc))


class DocPatch(BaseModel):
    status: str | None = Field(None, pattern="^(active|repealed)$")
    title: str | None = None
    number: str | None = None
    source_url: str | None = None


@router.patch("/{doc_id}")
async def patch_document(doc_id: int, body: DocPatch, staff: Staff = Depends(ADMIN),
                         s: AsyncSession = DB):
    """status=repealed removes the document from search immediately."""
    doc = await s.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "document not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(doc, k, v)
    return _doc(doc)
