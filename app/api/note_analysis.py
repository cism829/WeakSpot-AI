from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.note import Note
from app.models.note_analysis import NoteAnalysis
from app.services.analyzer import analyze_note_text

router = APIRouter(prefix="/analysis", tags=["note-analysis"])

@router.post("/{note_id}")
def analyze_one(
    note_id: UUID,
    subject: Optional[str] = Query(None, description="Override subject (e.g., physics)"),
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.note_id == note_id).first()
    if not note or not note.og_text:
        raise HTTPException(status_code=404, detail="note not found or empty")

    result = analyze_note_text(note.og_text, subject=subject)
    rec = NoteAnalysis(
        note_id=note.note_id,
        subject=result["subject"],
        summary=result["summary"],
        blocks=result["blocks"],
        flags=result["flags"],
        meta=result["meta"],
    )
    db.add(rec); db.commit(); db.refresh(rec)
    return {
        "analysis_id": rec.analysis_id,
        "note_id": rec.note_id,
        "subject": rec.subject,
        "summary": rec.summary,
        "blocks": rec.blocks,
        "flags": rec.flags,
        "meta": rec.meta,
    }

@router.get("/{note_id}")
def get_latest(note_id: UUID, db: Session = Depends(get_db)):
    rec = (
        db.query(NoteAnalysis)
        .filter(NoteAnalysis.note_id == note_id)
        .order_by(NoteAnalysis.created_at.desc())
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="no analysis for note")
    return {
        "analysis_id": rec.analysis_id,
        "note_id": rec.note_id,
        "subject": rec.subject,
        "summary": rec.summary,
        "blocks": rec.blocks,
        "flags": rec.flags,
        "meta": rec.meta,
    }
