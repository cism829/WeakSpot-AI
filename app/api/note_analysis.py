
from __future__ import annotations
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.note import Note
from app.models.note_analysis import NoteAnalysis
from app.services.analyzer import analyze_note_text, DEFAULT_SUBJECT

router = APIRouter(prefix="/analysis", tags=["note-analysis"])

@router.post("/{note_id}", summary="Run analysis on a note and save a snapshot")
def analyze_one(
    note_id: UUID,
    subject: Optional[str] = Query(None, description="Override subject (e.g., physics)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    note = db.query(Note).filter(Note.note_id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="note not found")
    if not (note.og_text or "").strip():
        raise HTTPException(status_code=400, detail="note has no text to analyze")

    result = analyze_note_text(note.og_text, subject or DEFAULT_SUBJECT)

    rec = NoteAnalysis(
        note_id=note.note_id,
        subject=result.get("subject"),
        summary=result.get("summary"),
        blocks=result.get("blocks"),
        flags=result.get("flags"),
        meta=result.get("meta"),
    )
    db.add(rec); db.commit(); db.refresh(rec)

    return {
        "analysis_id": str(rec.analysis_id),
        "note_id": str(rec.note_id),
        "subject": rec.subject,
        "summary": rec.summary,
        "blocks": rec.blocks,
        "flags": rec.flags,
        "meta": rec.meta,
        "created_at": rec.created_at.isoformat(),
    }

@router.get("/{note_id}/latest", summary="Fetch latest analysis for a note")
def get_latest(note_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    note = db.query(Note).filter(Note.note_id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="note not found")

    rec = (
        db.query(NoteAnalysis)
        .filter(NoteAnalysis.note_id == note.note_id)
        .order_by(desc(NoteAnalysis.created_at))
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="no analysis for note")
    return {
        "analysis_id": str(rec.analysis_id),
        "note_id": str(rec.note_id),
        "subject": rec.subject,
        "summary": rec.summary,
        "blocks": rec.blocks,
        "flags": rec.flags,
        "meta": rec.meta,
        "created_at": rec.created_at.isoformat(),
    }
