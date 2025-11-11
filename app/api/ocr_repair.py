
from typing import Optional, List, Any, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.note import Note
from app.models.note_repair import NoteRepair
from app.services.ocr_repair import suggest_repair_for_text
from app.core.security import get_current_user
router = APIRouter(prefix="/ocr/repair", tags=["ocr-repair"])

class RepairSuggestionOut(BaseModel):
    repair_id: UUID
    note_id: UUID
    status: str
    original_text: str
    suggested_text: str | None
    suggestion_log: List[Dict[str, Any]]

class ApplyIn(BaseModel):
    edited_text: Optional[str] = None   # if user edits before applying

@router.get("/{repair_id}")
def get_repair(repair_id: UUID, db: Session = Depends(get_db), user = Depends(get_current_user)):
    rep = db.query(NoteRepair).filter(
        NoteRepair.repair_id == repair_id,
        # optionally enforce ownership if model stores user_id:
        # NoteRepair.user_id == user.id
    ).first()
    if not rep:
        raise HTTPException(status_code=404, detail="repair not found")
    return {
        "repair_id": str(rep.repair_id),
        "note_id": str(rep.note_id),
        "status": rep.status,
        "original_text": rep.original_text,
        "suggested_text": rep.suggested_text,
        "suggestion_log": rep.suggestion_log,
    }
    
@router.post("/suggest/{note_id}", response_model=RepairSuggestionOut)
def suggest(note_id: UUID, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.note_id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="note not found")
    if not note.og_text:
        raise HTTPException(status_code=400, detail="note has no text")

    result = suggest_repair_for_text(note.og_text)
    suggested = result.get("suggested_text") or note.og_text
    status = "pending" if result.get("suggested_text") is not None else "noop"
    rep = NoteRepair(
        note_id=note.note_id,
        original_text=note.og_text,
        suggested_text=suggested,
        suggestion_log=result.get("log", []),
        status= status,
    )
    db.add(rep)
    db.flush()
    db.refresh(rep)
    db.commit()

    return {
        "repair_id": rep.repair_id,
        "note_id": rep.note_id,
        "status": rep.status,
        "original_text": rep.original_text,
        "suggested_text": rep.suggested_text,
        "suggestion_log": rep.suggestion_log,
    }

@router.post("/apply/{repair_id}", response_model=RepairSuggestionOut)
def apply(repair_id: UUID, body: ApplyIn = Body(...), db: Session = Depends(get_db)):
    rep = db.query(NoteRepair).filter(NoteRepair.repair_id == repair_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="repair not found")

    note = db.query(Note).filter(Note.note_id == rep.note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="note not found")

    final_text = body.edited_text if (body and body.edited_text) else (rep.suggested_text or rep.original_text)
    # Update the note's text with the accepted/edited version
    note.og_text = final_text
    rep.status = "accepted" if body.edited_text is None else "edited"
    db.commit()
    db.refresh(rep)

    return {
        "repair_id": rep.repair_id,
        "note_id": rep.note_id,
        "status": rep.status,
        "original_text": rep.original_text,
        "suggested_text": rep.suggested_text,
        "suggestion_log": rep.suggestion_log,
    }

@router.post("/reject/{repair_id}", response_model=RepairSuggestionOut)
def reject(repair_id: UUID, db: Session = Depends(get_db)):
    rep = db.query(NoteRepair).filter(NoteRepair.repair_id == repair_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="repair not found")
    rep.status = "rejected"
    db.commit()
    db.refresh(rep)
    return {
        "repair_id": rep.repair_id,
        "note_id": rep.note_id,
        "status": rep.status,
        "original_text": rep.original_text,
        "suggested_text": rep.suggested_text,
        "suggestion_log": rep.suggestion_log,
    }
