from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from uuid import UUID
import json
import os

from openai import OpenAI  # ✅ OpenAI SDK
from pydantic import BaseModel

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
)

# Reuse helpers from quizzes (no circular import)
from app.api.quizzes import _assert_openai, _build_system

router = APIRouter(prefix="/flashcards", tags=["flashcards"])

# ---------- Prompt builders ----------

def _build_flashcard_prompt_general(subject: str, topic: str, n: int) -> str:
    schema_hint = (
        "{\n"
        '  "items": [\n'
        '    { "front":"term or question", "back":"concise definition or answer", "hint":"optional mnemonic" }\n'
        "  ]\n"
        "}\n"
    )
    return (
        f"Create exactly {n} study flashcards.\n"
        f"SUBJECT: {subject}\n"
        f"TOPIC: {topic}\n"
        "Return STRICT JSON matching this schema:\n"
        f"{schema_hint}\n"
        "Rules:\n"
        "- Keep language clear, concise, and student-friendly.\n"
        "- Each 'front' must be a single unambiguous term or question.\n"
        "- Each 'back' must directly and correctly answer the 'front'.\n"
        "- 'hint' is optional and short.\n"
        "STRICT OUTPUT: JSON only (no prose, no code fences).\n"
    )

def _build_flashcard_prompt_from_note(n: int, note_text: str) -> str:
    schema_hint = (
        "{\n"
        '  "items": [\n'
        '    { "front":"term or question", "back":"concise, correct answer from NOTE_CONTENT", "hint":"optional mnemonic" }\n'
        "  ]\n"
        "}\n"
    )
    return (
        f"NOTE_CONTENT (the ONLY allowed source of facts):\n{note_text}\n\n"
        f"Create exactly {n} study flashcards using ONLY information explicitly contained in NOTE_CONTENT.\n"
        "If an item is not supported by NOTE_CONTENT, discard it and regenerate.\n"
        "Return STRICT JSON matching this schema:\n"
        f"{schema_hint}\n"
        "Rules:\n"
        "- 'front' is a clear term/question; 'back' must be directly supported by NOTE_CONTENT.\n"
        "- Keep all text concise and student-friendly; 'hint' is optional.\n"
        "STRICT OUTPUT: JSON only (no prose, no code fences).\n"
    )

def _strictify_schema(schema: dict) -> dict:
    """
    Make a Pydantic JSON schema compatible with OpenAI strict JSON schema:
    - additionalProperties:false on every object
    - required lists ALL keys in properties
    - properties that were optional are allowed to be null
    - ensure root is an object
    """
    import copy
    sc = copy.deepcopy(schema)

    def allow_null(prop_schema: dict) -> dict:
        # If already allows null, keep it; else wrap to allow null
        if not isinstance(prop_schema, dict):
            return prop_schema
        if prop_schema.get("type") == "null":
            return prop_schema
        if prop_schema.get("nullable") is True:
            return {"anyOf": [prop_schema, {"type": "null"}]}
        t = prop_schema.get("type")
        if isinstance(t, list) and "null" in t:
            return prop_schema
        if isinstance(t, str):
            return {"type": [t, "null"], **{k: v for k, v in prop_schema.items() if k != "type"}}
        # Fallback: wrap with anyOf
        if "anyOf" in prop_schema:
            # if anyOf already contains null, keep; else add it
            if not any(isinstance(x, dict) and x.get("type") == "null" for x in prop_schema["anyOf"]):
                return {"anyOf": prop_schema["anyOf"] + [{"type": "null"}]}
            return prop_schema
        return {"anyOf": [prop_schema, {"type": "null"}]}

    def walk(node: dict):
        if not isinstance(node, dict):
            return
        # Close all objects
        if node.get("type") == "object":
            node["additionalProperties"] = False
            props = node.get("properties") or {}
            # Compute full required list = all keys in properties
            if isinstance(props, dict):
                all_keys = list(props.keys())
                # If some were optional, allow null on them
                existing_required = set(node.get("required") or [])
                for k in all_keys:
                    if k not in existing_required:
                        props[k] = allow_null(props[k])
                node["required"] = all_keys

        # Recurse common schema containers
        for key in ("properties", "$defs", "definitions"):
            sub = node.get(key)
            if isinstance(sub, dict):
                for v in sub.values():
                    walk(v)

        for key in ("items", "anyOf", "oneOf", "allOf"):
            sub = node.get(key)
            if isinstance(sub, dict):
                walk(sub)
            elif isinstance(sub, list):
                for v in sub:
                    if isinstance(v, dict):
                        walk(v)

    walk(sc)

    # Ensure root object
    if sc.get("type") != "object":
        sc = {
            "type": "object",
            "additionalProperties": False,
            "properties": {"data": sc},
            "required": ["data"],
        }
    return sc

# ---------- OpenAI call ----------


# --- replace your _oai_json_call with this version ---
def _oai_json_call(schema_model: BaseModel.__class__, user_prompt: str) -> dict:
    model_name = (
        getattr(settings, "OPENAI_MODEL", None)
        or os.getenv("OPENAI_MODEL")
        or "gpt-4o-mini"
    )
    client = OpenAI(api_key=getattr(settings, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY"))

    raw_schema = schema_model.model_json_schema()
    schema_name = raw_schema.get("title") or schema_model.__name__
    schema = _strictify_schema(raw_schema)
    try:
        resp = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": _build_system()},
                {"role": "user", "content": user_prompt},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "schema": schema,
                    "strict": True,
                },
            },
            temperature=0.3,
            max_tokens=1024,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI error: {e}")

    text = None
    try:
        text = resp.choices[0].message.content
    except Exception:
        pass

    if not text:
        raise HTTPException(status_code=502, detail="OpenAI returned an empty response")

    try:
        return json.loads(text)
    except Exception:
        s = text.strip().strip("`")
        s = s[s.find("{"): s.rfind("}") + 1]
        try:
            return json.loads(s)
        except Exception:
            raise HTTPException(status_code=502, detail="OpenAI returned non-JSON content")

def _openai_generate_flashcards(subject: str, topic: str, n: int, note_text: str | None = None) -> List[dict]:
    _assert_openai()

    if note_text:
        user_prompt = _build_flashcard_prompt_from_note(n=n, note_text=note_text)
    else:
        user_prompt = _build_flashcard_prompt_general(subject=subject, topic=topic, n=n)

    data = _oai_json_call(FlashcardItems, user_prompt)

    items = (data or {}).get("items") or []
    out: List[dict] = []
    for it in items[:n]:
        front = (it.get("front") or "").strip()
        back = (it.get("back") or "").strip()
        hint = (it.get("hint") or None)
        hint = (hint.strip() if isinstance(hint, str) and hint.strip() else None)
        if front and back:
            out.append({"front": front, "back": back, "hint": hint})

    if not out:
        raise HTTPException(status_code=502, detail="OpenAI returned no usable flashcards")

    return out

# ---------- Endpoints ----------

@router.post("/generate-ai", response_model=FlashcardOut)
def generate_ai_flashcards(
    payload: GenerateWithoutNoteFC,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    items = _openai_generate_flashcards(subject=payload.subject, topic=payload.topic, n=payload.num_items)

    fc = Flashcard(
        user_id=user.id,
        note_id=None,
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
    note: Optional[Note] = (
        db.query(Note)
        .filter(Note.note_id == payload.note_id, Note.user_id == user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note_text = (note.og_text or "").strip()

    items = _openai_generate_flashcards(
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
