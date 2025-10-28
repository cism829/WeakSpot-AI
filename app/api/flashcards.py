# app/api/flashcards.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from uuid import UUID
import json
import os

from pydantic import BaseModel
from google import genai
from google.genai import types as gtypes
from google.genai import errors as genai_errors

from app.core.config import settings
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.flashcard import Flashcard
from app.models.flashcard_item import FlashcardItem
from app.models.note import Note
from app.schemas.flashcard_gen import (
    GenerateWithoutNoteFC,
    GenerateWithNoteFC,
    FlashcardOut,
    FlashcardItems,
    FlashcardItemModel,
)

# Reuse helpers from quizzes
from app.api.quizzes import _assert_gemini, _build_system

router = APIRouter(prefix="/flashcards", tags=["flashcards"])

# ---------- Prompt builder ----------

def _build_flashcard_user_prompt(subject: str, topic: str, n: int, note_text: str | None = None) -> str:
    schema_hint = (
        "{\n"
        '  "items": [\n'
        '    { "front":"term or question", "back":"concise definition or answer", "hint":"optional mnemonic" }\n'
        "  ]\n"
        "}\n"
    )
    note_clause = f"\nContext (from student notes):\n{note_text}\n" if note_text else ""
    return (
        f"Create exactly {n} study flashcards.\n"
        f"SUBJECT: {subject}\n"
        f"TOPIC: {topic}\n"
        f"{note_clause}"
        "Return STRICT JSON matching this schema:\n"
        f"{schema_hint}\n"
        "Rules:\n"
        "- Keep language clear, concise, and student-friendly.\n"
        "- Each 'front' must be a single unambiguous term or question.\n"
        "- Each 'back' must directly and correctly answer the 'front'.\n"
        "- 'hint' is optional and should be a short mnemonic or quick reminder.\n"
        "- Do not include duplicate items or contradictory facts.\n"
        "- If note context is given, use only facts supported by that context.\n"
        "\n"
        "STRICT OUTPUT REQUIREMENTS:\n"
        "1) Produce ONLY valid JSON (no prose, no code fences, no comments).\n"
        "2) Escape quotes properly and do not include trailing commas.\n"
        "\n"
        "INTERNAL CONSISTENCY CHECK (do not output this text — just enforce it):\n"
        "- Every item must have non-empty 'front' and 'back'.\n"
        "- 'back' must directly answer/define 'front'; 'hint' must not contradict 'back'.\n"
        "- If any item fails, fix it before returning the final JSON.\n"
    )

# ---------- AI call ----------

def _gemini_generate_flashcards(subject: str, topic: str, n: int, note_text: str | None = None) -> List[dict]:
    _assert_gemini()
    api_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
    model_name = getattr(settings, "GEMINI_MODEL", None) or "gemini-2.5-flash"

    if os.getenv("DEV_STUB_FLASHCARDS") == "1":
        return [{"front": f"Term {i+1}", "back": f"Definition {i+1}", "hint": None} for i in range(n)]

    client = genai.Client(api_key=api_key)

    try:
        cfg = gtypes.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=1024,
            system_instruction=_build_system(),
            response_mime_type="application/json",
            response_schema=FlashcardItems,
        )

        user_prompt = _build_flashcard_user_prompt(subject, topic, n, note_text)

        resp = client.models.generate_content(
            model=model_name,
            contents=user_prompt,
            config=cfg,
        )

        data = getattr(resp, "parsed", None)
        if isinstance(data, BaseModel):
            data = data.model_dump()
        elif data is None:
            data = json.loads(resp.text or "{}")

        items = (data or {}).get("items") or []
        out: List[dict] = []

        for it in items[:n]:
            front = (it.get("front") or "").strip()
            back = (it.get("back") or "").strip()
            hint = (it.get("hint") or None)
            hint = (hint.strip() if isinstance(hint, str) and hint.strip() else None)

            if not front or not back:
                continue

            out.append({"front": front, "back": back, "hint": hint})

        if not out:
            print("DEBUG raw model text:", (resp.text or "")[:1000])
            raise HTTPException(status_code=502, detail="Gemini returned no usable flashcards")

        return out

    except genai_errors.APIError as e:
        raise HTTPException(status_code=e.code or 502, detail=f"Gemini error: {e.message}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {e}")

# ---------- Endpoints ----------

@router.post("/generate-ai", response_model=FlashcardOut)
def generate_ai_flashcards(
    payload: GenerateWithoutNoteFC,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    items = _gemini_generate_flashcards(subject=payload.subject, topic=payload.topic, n=payload.num_items)

    fc = Flashcard(
        user_id=user.id,           # users.id is String(UUID text)
        note_id=None,              # no note context
        title=payload.title or (f"{payload.subject} · {payload.topic}".strip(" ·")),
        subject=payload.subject,
        topic=payload.topic or None,
        source="ai_general",
    )
    db.add(fc)
    db.flush()

    for it in items:
        db.add(FlashcardItem(flashcard_id=fc.id, front=it["front"], back=it["back"], hint=it.get("hint")))

    db.commit()
    db.refresh(fc)

    return {
        "id": fc.id,
        "title": fc.title,
        "subject": fc.subject,
        "topic": fc.topic,
        "source": fc.source,
        "items": [{"id": i.id, "front": i.front, "back": i.back, "hint": i.hint} for i in fc.items],
    }

@router.post("/generate-ai-from-note", response_model=FlashcardOut)
def generate_ai_flashcards_from_note(
    payload: GenerateWithNoteFC,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    # ✅ fetch by UUID PK + ownership; Note.og_text holds uploaded/original text
    note: Optional[Note] = (
        db.query(Note)
        .filter(Note.note_id == payload.note_id, Note.user_id == user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note_text = (note.og_text or "").strip()

    items = _gemini_generate_flashcards(
        subject=payload.subject, topic=payload.topic, n=payload.num_items, note_text=note_text or None
    )

    fc = Flashcard(
        user_id=user.id,
        note_id=payload.note_id,
        title=payload.title or f"Flashcards from note {payload.note_id} · {payload.subject} · {payload.topic}".strip(),
        subject=payload.subject,
        topic=payload.topic or None,
        source="ai_note",
    )
    db.add(fc)
    db.flush()

    for it in items:
        db.add(FlashcardItem(flashcard_id=fc.id, front=it["front"], back=it["back"], hint=it.get("hint")))

    db.commit()
    db.refresh(fc)

    return {
        "id": fc.id,
        "title": fc.title,
        "subject": fc.subject,
        "topic": fc.topic,
        "source": fc.source,
        "items": [{"id": i.id, "front": i.front, "back": i.back, "hint": i.hint} for i in fc.items],
    }

@router.get("/mine")
def list_my_flashcards(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    fcs = db.query(Flashcard).filter(Flashcard.user_id == user.id).order_by(Flashcard.id.desc()).all()
    return [
        {
            "id": f.id,
            "title": f.title,
            "subject": f.subject,
            "topic": f.topic,
            "source": f.source,
            "created_at": f.created_at.isoformat() if getattr(f, "created_at", None) else None,
        }
        for f in fcs
    ]

@router.get("/{fc_id}", response_model=FlashcardOut)
def get_flashcard(fc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    fc = db.query(Flashcard).filter(Flashcard.id == fc_id, Flashcard.user_id == user.id).first()
    if not fc:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    return {
        "id": fc.id,
        "title": fc.title,
        "subject": fc.subject,
        "topic": fc.topic,
        "source": fc.source,
        "items": [{"id": i.id, "front": i.front, "back": i.back, "hint": i.hint} for i in fc.items],
    }
