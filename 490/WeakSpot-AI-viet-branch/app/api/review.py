from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, List, Any
import json

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.quiz import Quiz
from app.models.quiz_item import QuizItem
from app.models.result import Result

router = APIRouter(prefix="/quizzes", tags=["review"])

def _safe_json_loads(s):
    """
    Accepts str | list | dict | None and returns a Python object or None.
    - If already a list/dict (e.g., JSONB deserialized by SQLAlchemy), return as-is.
    - If str, try json.loads; if it fails, return None.
    - Otherwise, return None.
    """
    if s is None:
        return None
    if isinstance(s, (list, dict)):
        return s
    if isinstance(s, (bytes, bytearray)):
        try:
            return json.loads(s.decode("utf-8", errors="ignore"))
        except Exception:
            return None
    if isinstance(s, str):
        s = s.strip()
        if not s:
            return None
        try:
            return json.loads(s)
        except Exception:
            return None
    return None


def _normalize_item_row(qi: QuizItem) -> Dict[str, Any]:
    """
    Build a normalized item payload and derive the correct answer text.
    Supports:
      - MCQ via answer_index -> choices[answer_index]
      - If index missing, try matching answer_text inside choices
      - Non-MCQ via answer_text
    Also tolerates choices being:
      - list[str]
      - list[dict] with keys like 'text' or 'label'
    """
    choices = _safe_json_loads(qi.choices)
    qtype = (qi.type or "").lower().strip()

    def choice_to_text(c):
        if isinstance(c, str):
            return c
        if isinstance(c, dict):
            # common shapes
            for k in ("text", "label", "value", "answer"):
                if k in c and isinstance(c[k], str):
                    return c[k]
        return str(c)

    correct_text = None
    if qtype == "mcq":
        idx = qi.answer_index
        # allow string index (e.g., "2")
        if isinstance(idx, str):
            try:
                idx = int(idx)
            except Exception:
                idx = None

        # first, try by index
        if isinstance(choices, list) and isinstance(idx, int) and 0 <= idx < len(choices):
            correct_text = choice_to_text(choices[idx])

        # fallback: try to locate answer_text within choices
        if not correct_text and isinstance(choices, list) and qi.answer_text:
            at = (qi.answer_text or "").strip()
            for c in choices:
                if choice_to_text(c).strip() == at:
                    correct_text = at
                    break

        # last fallback
        if not correct_text:
            correct_text = (qi.answer_text or "").strip() or None
    else:
        correct_text = (qi.answer_text or "").strip() or None

    # Normalize output choices to strings if present
    norm_choices = None
    if isinstance(choices, list):
        norm_choices = [choice_to_text(c) for c in choices]

    return {
        "id": qi.id,
        "type": qi.type,
        "question": qi.question,
        "choices": norm_choices,
        "correct_text": correct_text,
        "explanation": qi.explanation or "",
    }


def _load_result_answers_if_exist(db: Session, result_id: int) -> Dict[int, Dict[str, Any]]:
    """Try to read per-item answers from an optional table `result_answers`.
    If the table isn't present, return {} safely.
    """
    try:
        rows = db.execute(
            text("""
                SELECT item_id, user_answer, is_correct
                FROM result_answers
                WHERE result_id = :rid
            """),
            {"rid": result_id},
        ).fetchall()
    except Exception:
        return {}
    ans: Dict[int, Dict[str, Any]] = {}
    for r in rows:
        item_id, user_answer, is_correct = r[0], r[1], r[2]
        ans[int(item_id)] = {
            "your": user_answer,
            "correct": bool(is_correct) if is_correct is not None else None,
        }
    return ans

def _find_best_result(db: Session, user_id: int, quiz_id: int) -> Result | None:
    return (
        db.query(Result)
        .filter(Result.user_id == user_id, Result.quiz_id == quiz_id)
        .order_by(Result.score.desc(), Result.taken_at.desc())
        .first()
    )


def _assemble_review(db: Session, user: User, quiz_id: int) -> Dict[str, Any]:
    q = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")

    best = _find_best_result(db, user.id, quiz_id)

    # Load items
    items = (
        db.query(QuizItem)
        .filter(QuizItem.quiz_id == quiz_id)
        .order_by(QuizItem.id.asc())
        .all()
    )

    answers_map: Dict[int, Dict[str, Any]] = {}
    if best:
        answers_map = _load_result_answers_if_exist(db, best.id)

    rows: List[Dict[str, Any]] = []
    for qi in items:
        base = _normalize_item_row(qi)
        ans = answers_map.get(qi.id, None)
        rows.append({
            "q": base["question"],
            "your": (ans or {}).get("your", ""),
            "correctAns": base["correct_text"] or "",
            "why": base["explanation"] or "",
            "correct": (ans or {}).get("correct", None),
        })

    raw = float(best.score) if best else None
    total = len(items)
    percent = (raw / total * 100.0) if (raw is not None and total > 0) else None

    payload: Dict[str, Any] = {
        "quiz_id": q.id,
        "title": q.title,
        "mode": q.mode,
        "raw_correct": raw,
        "total": total,
        "percent": percent,
        # keep legacy field for older clients; set to percent for UI expectations
        "score": percent,
        "taken_at": str(best.taken_at) if best else None,
        "items": rows,
    }
    return payload



@router.get("/{quiz_id}/best")
def best_attempt_review(
    quiz_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return a normalized 'best attempt' review for this quiz.
    - If per-item answers exist in `result_answers`, include them
    - Otherwise, return explanations-only (correct answers + why)
    Never raises if answers table is missing.
    """
    return _assemble_review(db, user, quiz_id)
