
from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.note import Note
from app.models.note_analysis import NoteAnalysis

router = APIRouter(prefix="/notes", tags=["notes"])

def _note_out(n: Note, last_analysis: Optional[NoteAnalysis] = None) -> dict:
    preview = (n.og_text or "")[:240] if n.og_text else None
    out = {
        "id": str(n.note_id),
        "status": n.status,
        "created_at": n.created_at.isoformat() if getattr(n, "created_at", None) else None,
        "preview_text": preview,
    }
    if last_analysis:
        out["last_analysis"] = {
            "analysis_id": str(last_analysis.analysis_id),
            "subject": last_analysis.subject,
            "summary": last_analysis.summary,
            "created_at": last_analysis.created_at.isoformat(),
        }
    return out

@router.get("/mine", summary="List my notes")
def list_my_notes(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> List[dict]:
    notes = (
        db.query(Note)
        .filter(Note.user_id == user.id)
        .order_by(desc(Note.created_at))
        .all()
    )
    # attach last analysis if exists
    out = []
    for n in notes:
        last = (
            db.query(NoteAnalysis)
            .filter(NoteAnalysis.note_id == n.note_id)
            .order_by(desc(NoteAnalysis.created_at))
            .first()
        )
        out.append(_note_out(n, last))
    return out

@router.get("/{note_id}", summary="Get a single note (with text)")
def get_note(note_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    n = db.query(Note).filter(Note.note_id == note_id, Note.user_id == user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="note not found")
    last = (
        db.query(NoteAnalysis)
        .filter(NoteAnalysis.note_id == n.note_id)
        .order_by(desc(NoteAnalysis.created_at))
        .first()
    )
    out = _note_out(n, last)
    out["content_text"] = n.og_text
    return out

class CreateNoteIn:
    og_text: str

@router.post("", summary="Create a text note")
def create_note(
    og_text: str = Form(..., description="Raw text content of the note"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    og_text = (og_text or "").strip()
    if not og_text:
        raise HTTPException(status_code=400, detail="og_text is required")
    n = Note(user_id=user.id, og_text=og_text, status="uploaded")
    db.add(n); db.commit(); db.refresh(n)
    return _note_out(n)

@router.post("/upload", summary="Upload a note file (basic text only)")
async def upload_note_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    # Minimal handling: accept text/*; for other types, store placeholder text
    content_type = (file.content_type or "").lower()
    raw = await file.read()
    text = None
    if content_type.startswith("text/"):
        try:
            text = raw.decode("utf-8", errors="ignore")
        except Exception:
            text = raw.decode("latin-1", errors="ignore")
    else:
        # Could wire to OCR pipeline later
        text = None

    n = Note(user_id=user.id, og_text=text, status="uploaded")
    db.add(n); db.commit(); db.refresh(n)
    return _note_out(n)

@router.delete("/{note_id}", summary="Delete one of my notes")
def delete_note(note_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    n = db.query(Note).filter(Note.note_id == note_id, Note.user_id == user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="note not found")
    db.delete(n); db.commit()
    return {"ok": True}

@router.patch("/{note_id}", summary="Update a note's text or status")
def patch_note(
    note_id: UUID,
    og_text: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    n = db.query(Note).filter(Note.note_id == note_id, Note.user_id == user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="note not found")
    changed = False
    if og_text is not None:
        n.og_text = og_text
        changed = True
    if status is not None:
        n.status = status
        changed = True
    if changed:
        db.add(n); db.commit(); db.refresh(n)
    return _note_out(n)
