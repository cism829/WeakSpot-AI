# app/api/flashcards.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List, Optional
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
from app.schemas.flashcard_gen import GenerateWithoutNoteFC, GenerateWithNoteFC, FlashcardOut, FlashcardItems, FlashcardItemModel

# Reuse the same helpers/quasi-system behaviors as quizzes
from app.api.quizzes import _assert_gemini, _build_system  # identical behavior

router = APIRouter(prefix="/flashcards", tags=["flashcards"])



# ---------- Prompt builder (mirrors quizzes style) ----------

def _build_flashcard_user_prompt(subject: str, n: int, note_text: str | None = None) -> str:
    """
    Build a JSON-only instruction, same tone/strictness as quizzes, but for flashcards.
    """
    schema_hint = (
        "{\n"
        '  "items": [\n'
        '    { "front":"term or question", "back":"concise definition or answer", "hint":"optional mnemonic" }\n'
        "  ]\n"
        "}\n"
    )

    note_clause = f"\nContext (from student notes):\n{note_text}\n" if note_text else ""

    return (
        f"Create exactly {n} study flashcards for: {subject}.\n"
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

# ---------- AI call (copies quizzes' SDK pattern) ----------

def _gemini_generate_flashcards(subject: str, n: int, note_text: str | None = None) -> List[dict]:
    """
    Call Gemini exactly like quizzes: SDK client, response_schema -> parsed output,
    strict JSON, then coerce to a simple dict list with front/back/hint.
    """
    _assert_gemini()
    api_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
    model_name = getattr(settings, "GEMINI_MODEL", None) or "gemini-2.5-flash"

    # Dev stub to keep end-to-end working without the network
    if os.getenv("DEV_STUB_FLASHCARDS") == "1":
        return [{"front": f"Term {i+1}", "back": f"Definition {i+1}", "hint": None} for i in range(n)]

    client = genai.Client(api_key=api_key)

    try:
        cfg = gtypes.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=1024,
            system_instruction=_build_system(),       # same tone/rules as quizzes
            response_mime_type="application/json",   # force JSON
            response_schema=FlashcardItems,          # <-- Pydantic schema
        )

        user_prompt = _build_flashcard_user_prompt(subject, n, note_text)

        resp = client.models.generate_content(
            model=model_name,
            contents=user_prompt,
            config=gtypes.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=1024,
            system_instruction=_build_system(),
            response_mime_type="application/json",
            response_schema=FlashcardItems,  # Pydantic schema
        ),
        )

        # Prefer structured parse when response_schema is set
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
    """
    Generate flashcards without note context, then persist and return the set.
    """
    items = _gemini_generate_flashcards(subject=payload.subject, n=payload.num_items)

    fc = Flashcard(
        user_id=user.id,
        note_id=None,
        title=payload.title or "Generated Flashcards",
        subject=payload.subject,
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
        "source": fc.source,
        "items": [{"id": i.id, "front": i.front, "back": i.back, "hint": i.hint} for i in fc.items],
    }

@router.post("/generate-ai-from-note", response_model=FlashcardOut)
def generate_ai_flashcards_from_note(
    payload: GenerateWithNoteFC,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Generate flashcards with note context, then persist and return the set.
    Tries ORM first for note text; falls back to the raw-SQL style used in quizzes.py, if needed.
    """
    # Prefer ORM
    note_text: Optional[str] = None
    note_obj: Optional[Note] = db.query(Note).filter(Note.id == payload.note_id, Note.user_id == user.id).first()
    if note_obj is not None:
        # Common columns are text/content/body; pick what's available
        note_text = getattr(note_obj, "text", None) or getattr(note_obj, "content", None) or getattr(note_obj, "body", None) or ""

    # Fallback to the same style used in quizzes (raw SQL by id/file)
    if not note_text:
        try:
            row = db.execute(text("SELECT content FROM notes WHERE id=:nid OR file=:nid"), {"nid": payload.note_id}).fetchone()
            if row and row[0]:
                note_text = row[0]
        except Exception:
            pass

    note_text = (note_text or "").strip()
    if not note_text:
        raise HTTPException(status_code=404, detail="Note not found or has no content")

    items = _gemini_generate_flashcards(subject=payload.subject, n=payload.num_items, note_text=note_text)

    fc = Flashcard(
        user_id=user.id,
        note_id=payload.note_id,
        title=payload.title or f"Flashcards from {getattr(note_obj, 'filename', 'note')}",
        subject=payload.subject,
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
        "source": fc.source,
        "items": [{"id": i.id, "front": i.front, "back": i.back, "hint": i.hint} for i in fc.items],
    }
