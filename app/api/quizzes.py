from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List, Dict, Any
import json
import os

from app.core.config import settings
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.quiz import Quiz
from app.models.quiz_item import QuizItem
from app.models.result import Result
from app.models.attempt import Attempt
from app.schemas.quiz_gen import GenerateWithNote, GenerateWithoutNote, QuizOut, QuizItemOut, SubmitPayload
from app.schemas.quiz import QuizItems  # Pydantic schema for structured output

# ---- Gemini SDK ----
from google import genai
from google.genai import types as gtypes
from google.genai import errors as genai_errors
from pydantic import BaseModel

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

# ---------- Gemini helpers ----------

def _assert_gemini():
    """
    Ensure a Gemini API key is configured.
    Accept either settings.GEMINI_API_KEY or GOOGLE_API_KEY env var.
    """
    if not (getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GOOGLE_API_KEY")):
        raise HTTPException(status_code=400, detail="Gemini API key not configured")

def _build_system():
    """
    System instruction for concise, unambiguous items and JSON-only output.
    """
    return (
        "You are a helpful tutor that writes concise, unambiguous assessment items. "
        "Always return STRICT JSON that matches the provided schema. "
        "Do not include any explanations outside of JSON."
    )

def _build_user_prompt(subject: str, difficulty: str, n: int, item_types: List[str], note_text: str | None = None) -> str:
    """
    Build a detailed instruction for the model.
    """
    type_desc = {
        "mcq": (
            '{ "type":"mcq", "question":"...", "choices":["A","B","C","D"], '
            '"answer_index": 0, "explanation":"..." }'
        ),
        "short_answer": (
            '{ "type":"short_answer", "question":"...", '
            '"answer_text":"concise expected answer", "explanation":"..." }'
        ),
        "fill_blank": (
            '{ "type":"fill_blank", "question":"Use __ to complete the sentence", '
            '"answer_text":"word or phrase", "explanation":"..." }'
        ),
        "true_false": (
            '{ "type":"true_false", "question":"...", '
            '"answer_text":"True" | "False", "explanation":"..." }'
        ),
    }

    # Only include templates for requested types that we know
    allowed_join = ", ".join(type_desc[t] for t in item_types if t in type_desc)

    note_clause = f"\nContext (from student notes):\n{note_text}\n" if note_text else ""
    types_list = ", ".join(item_types)

    schema_hint = (
        "{{\n"
        '  "items": [\n'
        "    {{ \"one_of\": [\n"
        f"      {allowed_join}\n"
        "    ]}}\n"
        "  ]\n"
        "}}\n"
    )

    return (
        f"Create {n} {difficulty} {subject} questions across these item types: {types_list}.\n"
        f"{note_clause}"
        "Return STRICT JSON with this schema:\n"
        f"{schema_hint}\n"
        "Rules:\n"
        f"- Questions must be solvable without external info beyond common {subject} knowledge and any provided context.\n"
        "- MCQ uses exactly 4 choices.\n"
        '- True/False uses the words "True" or "False" in answer_text.\n'
        "- Keep explanations brief, 1–2 sentences max.\n"
    )

def _coerce_item(it: dict) -> dict | None:
    t = (it.get("type") or "").lower().replace("-", "_")
    if t in {"multiple_choice", "multiplechoice", "mc"}:
        t = "mcq"
    if t in {"truefalse", "true_or_false", "tf"}:
        t = "true_false"

    q = (it.get("question") or "").strip()
    if not q:
        return None

    exp = (it.get("explanation") or "").strip() or None

    if t == "mcq":
        choices = it.get("choices") or it.get("options") or []
        if isinstance(choices, str):
            choices = [c.strip() for c in choices.split("|") if c.strip()]
        if not isinstance(choices, list) or len(choices) < 2:
            return None
        choices = choices[:4]  # enforce max 4

        # Determine answer_index robustly
        orig_ai = it.get("answer_index")
        ai = None
        if orig_ai is not None:
            try:
                ai = int(orig_ai)
            except Exception:
                ai = None

        if ai is None:
            ans = it.get("answer") or it.get("answer_text")
            if isinstance(ans, str):
                letter_map = {"a": 0, "b": 1, "c": 2, "d": 3}
                if ans.lower() in letter_map:
                    ai = letter_map[ans.lower()]
                elif ans in choices:
                    ai = choices.index(ans)

        # Convert 1-based to 0-based if it looks like 1..len
        if isinstance(orig_ai, int) and 1 <= orig_ai <= len(choices):
            ai = orig_ai - 1

        if ai is None:
            ai = 0
        ai = max(0, min(ai, len(choices) - 1))

        return {
            "type": "mcq",
            "question": q,
            "choices": choices,
            "answer_index": ai,
            "answer_text": None,
            "explanation": exp,
        }

    if t in {"short_answer", "fill_blank", "true_false"}:
        ans = it.get("answer_text")
        if ans is None and "answer" in it:
            ans = it["answer"]
        if t == "true_false":
            if ans is True:
                ans = "True"
            if ans is False:
                ans = "False"
        ans = (str(ans)).strip() if ans is not None else ""
        if not ans:
            return None
        return {
            "type": t,
            "question": q,
            "choices": None,
            "answer_index": None,
            "answer_text": ans,
            "explanation": exp,
        }

    return None

def _gemini_generate(subject: str, difficulty: str, n: int, item_types: List[str], note_text: str | None = None):
    """
    Call Gemini to generate items; then parse and normalize them.
    """
    _assert_gemini()
    api_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GOOGLE_API_KEY")
    model_name = getattr(settings, "GEMINI_MODEL", None) or "gemini-2.5-flash"

    client = genai.Client(api_key=api_key)

    try:
        cfg = gtypes.GenerateContentConfig(
            temperature=0.4,
            max_output_tokens=2048,
            system_instruction=_build_system(),
            response_mime_type="application/json",  # JSON-only
            response_schema=QuizItems,              # Pydantic schema -> structured output
        )

        user_prompt = _build_user_prompt(subject, difficulty, n, item_types, note_text)

        resp = client.models.generate_content(
            model=model_name,
            contents=user_prompt,  # string is fine; SDK wraps it into Content/Part
            config=cfg,
        )

        # Prefer structured parse when response_schema is set
        data = getattr(resp, "parsed", None)
        if isinstance(data, BaseModel):
            data = data.model_dump()
        elif data is None:
            data = json.loads(resp.text or "{}")

        raw_items = data.get("items") if isinstance(data, dict) else None
        if raw_items is None:
            raw_items = data.get("questions") if isinstance(data, dict) else []
        if isinstance(raw_items, dict):  # nested again
            raw_items = raw_items.get("items", [])

        out: List[dict] = []
        for it in (raw_items or [])[:n]:
            norm = _coerce_item(it)
            if norm:
                out.append(norm)

        if not out:
            print("DEBUG raw model text:", (resp.text or "")[:1000])
            raise HTTPException(status_code=502, detail="Gemini returned items, but none were usable after normalization")

        return out

    except genai_errors.APIError as e:
        raise HTTPException(status_code=e.code or 502, detail=f"Gemini error: {e.message}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini error: {e}")

# ---------- Create Quiz + persist items ----------

def _persist_quiz_and_items(
    db: Session, *, user_id: int, note_id: int | None, subject: str,
    difficulty: str, mode: str, types: List[str], items: List[dict], source: str
) -> int:
    q = Quiz(
        user_id=user_id,
        note_id=note_id,
        title=f"{subject.title()} Quiz",
        difficulty=difficulty,
        mode=mode,
        source=source,
        types=",".join(types) if types else None,
    )
    db.add(q)
    db.flush()

    for it in items:
        db.add(
            QuizItem(
                quiz_id=q.id,
                type=it["type"],
                question=it["question"],
                choices=(json.dumps(it["choices"]) if it.get("choices") else None),
                answer_index=it.get("answer_index"),
                answer_text=it.get("answer_text"),
                explanation=it.get("explanation"),
            )
        )

    db.commit()
    return q.id

# ---------- Endpoints ----------

@router.post("/generate-ai")
def generate_ai(
    payload: GenerateWithoutNote,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Generate a quiz using Gemini *without* note context, then persist it.
    """
    items = _gemini_generate(
        subject=payload.subject,
        difficulty=payload.difficulty,
        n=payload.num_items,
        item_types=payload.types,
        note_text=None,
    )
    quiz_id = _persist_quiz_and_items(
        db,
        user_id=user.id,
        note_id=None,
        subject=payload.subject,
        difficulty=payload.difficulty,
        mode=payload.mode,
        types=payload.types,
        items=items,
        source="ai_general",
    )
    return {"quiz_id": quiz_id}

@router.post("/generate-ai-from-note")
def generate_ai_from_note(
    payload: GenerateWithNote,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Generate a quiz using Gemini *with* note context (from a notes table).
    """
    note = db.execute(text("SELECT content FROM notes WHERE id=:nid"), {"nid": payload.note_id}).fetchone()
    note_text = note[0] if note else ""

    items = _gemini_generate(
        subject=payload.subject,
        difficulty=payload.difficulty,
        n=payload.num_items,
        item_types=payload.types,
        note_text=note_text or None,
    )

    quiz_id = _persist_quiz_and_items(
        db,
        user_id=user.id,
        note_id=payload.note_id,
        subject=payload.subject,
        difficulty=payload.difficulty,
        mode=payload.mode,
        types=payload.types,
        items=items,
        source="ai_note",
    )
    return {"quiz_id": quiz_id}

def _quiz_to_dict(q: Quiz) -> Dict[str, Any]:
    return {
        "id": q.id,
        "title": q.title,
        "difficulty": q.difficulty,
        "mode": q.mode,
        "source": q.source,
        "types": q.types,
        "created_at": str(q.created_at),
    }

@router.get("/mine")
def list_my_quizzes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    List the current user's quizzes split into "practice" and "exam",
    plus attach simple stats (attempt count, best score, last taken).
    """
    quizzes = db.query(Quiz).filter(Quiz.user_id == user.id).order_by(Quiz.created_at.desc()).all()

    stats = (
        db.query(
            Result.quiz_id,
            func.count(Result.id).label("attempts"),
            func.max(Result.score).label("best_score"),
            func.max(Result.taken_at).label("last_taken_at"),
        )
        .filter(Result.user_id == user.id)
        .group_by(Result.quiz_id)
        .all()
    )

    s_map = {
        qid: {
            "attempts": att,
            "best_score": best,
            "last_taken_at": str(last) if last else None,
        }
        for (qid, att, best, last) in stats
    }

    def pack(q: Quiz) -> Dict[str, Any]:
        st = s_map.get(q.id, {})
        return {
            "id": q.id,
            "title": q.title,
            "mode": q.mode,
            "difficulty": q.difficulty,
            "created_at": str(q.created_at),
            "attempts": st.get("attempts", 0),
            "best_score": st.get("best_score"),
            "last_taken_at": st.get("last_taken_at"),
        }

    practice, exam = [], []
    for q in quizzes:
        (exam if (q.mode or "").lower() == "exam" else practice).append(pack(q))

    return {"practice": practice, "exam": exam}

@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Fetch a single quiz (owned by current user) with its items.
    """
    q = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return QuizOut(
        id=q.id,
        title=q.title,
        difficulty=q.difficulty,
        mode=q.mode,
        created_at=str(q.created_at),
        items=[
            QuizItemOut(
                id=qi.id,
                question=qi.question,
                type=qi.type,
                choices=(json.loads(qi.choices) if qi.choices else None),
                explanation=qi.explanation,
            )
            for qi in q.items
        ],
    )

@router.post("/{quiz_id}/start")
def start_practice(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Start a practice attempt. First attempt awards coins; subsequent calls do not.
    """
    q = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    existed = db.query(Attempt).filter(Attempt.user_id == user.id, Attempt.quiz_id == quiz_id).first()
    if existed:
        return {
            "ok": True,
            "awarded": False,
            "coins_balance": user.coins_balance,
            "coins_earned_total": user.coins_earned_total,
        }

    att = Attempt(quiz_id=quiz_id, user_id=user.id)
    db.add(att)
    user.coins_earned_total = (user.coins_earned_total or 0) + settings.COIN_PER_QUIZ
    user.coins_balance = (user.coins_balance or 0) + settings.COIN_PER_QUIZ
    db.commit()

    return {
        "ok": True,
        "awarded": True,
        "coins_balance": user.coins_balance,
        "coins_earned_total": user.coins_earned_total,
    }

@router.post("/{quiz_id}/submit")
def submit_quiz(quiz_id: int, payload: SubmitPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Submit a finished quiz:
        - Persist a Result (score + time spent)
        - Increment user's total_points by rounded score
        - Return updated totals (coins are unchanged here)
    """
    q = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    r = Result(quiz_id=quiz_id, user_id=user.id, score=payload.score, time_spent_sec=payload.time_spent_sec)
    db.add(r)

    user.total_points = (user.total_points or 0) + int(round(payload.score or 0))
    db.commit()

    return {
        "ok": True,
        "coins_earned_total": user.coins_earned_total,
        "coins_balance": user.coins_balance,
        "total_points": user.total_points,
    }
