
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from openai import OpenAI
from app.core.db import get_db
from app.core.config import settings
from app.models.note import Note
from app.services.chunking import chunk_and_store
from app.core.security import get_current_user 
from app.models.user import User        
router = APIRouter(prefix="/chunk", tags=["chunking"])

@router.post("/backfill")
def backfill_chunks(
    only_missing: bool = Query(True),
    max_chars: int = Query(800, ge=200, le=2000),
    overlap: int = Query(80, ge=0, le=400),
    embed_model: str = Query("text-embedding-3-small"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  

):
    client: Optional[OpenAI] = None
    if settings.OPENAI_API_KEY:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

    base = db.query(Note).filter(Note.og_text != None, Note.user_id == user.id)  # ⟵ scope to owner
    if only_missing:
        notes = base.outerjoin(Note.chunks).filter(Note.chunks == None).all()
    else:
        notes = base.all()

    total = 0
    for n in notes:
        total += chunk_and_store(db, n, client, embed_model, max_chars, overlap)
    db.commit()
    return {"notes_processed": len(notes), "chunks_written": total}

@router.post("/{note_id}")
def chunk_one(
    note_id: str,
    max_chars: int = Query(800, ge=200, le=2000),
    overlap: int = Query(80, ge=0, le=400),
    embed_model: str = Query("text-embedding-3-small"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    client: Optional[OpenAI] = None
    if settings.OPENAI_API_KEY:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
    note = db.query(Note).filter(Note.note_id == note_id, Note.user_id == user.id).first()  # ⟵ owner check
    if not note:
        raise HTTPException(status_code=404, detail="note not found")
    written = chunk_and_store(db, note, client, embed_model, max_chars, overlap)
    db.commit()
    return {"note_id": str(note.note_id), "chunks_written": written}
