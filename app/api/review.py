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

def _safe_json_loads(s: str | None):
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:
        return None

def _normalize_item_row(qi: QuizItem) -> Dict[str, Any]:
    # Build a normalized item payload and derive the correct answer text
    choices = _safe_json_loads(qi.choices)
    correct_text = None
    if (qi.type or "").lower() == "mcq":
        try:
            idx = int(qi.answer)
        except Exception:
            idx = 0
        if isinstance(choices, list) and 0 <= idx < len(choices):
            correct_text = str(choices[idx])
    else:
        correct_text = (qi.answer or "").strip() or None
    return {
        "id": qi.id,
        "type": qi.type,
        "question": qi.question,
        "choices": choices if isinstance(choices, list) else None,
        "correct_text": correct_text,
        "explanation": qi.explanation or "",
    }

def _load_result_answers_if_exist(db: Session, result_id: int) -> Dict[int, Dict[str, Any]]:
    """Try to read per-item answers from an optional table `result_answers`.
    If the table isn't present, return {} safely."""
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
    ans = {}
    for r in rows:
        item_id, user_answer, is_correct = r[0], r[1], r[2]
        ans[int(item_id)] = {
            "your": user_answer,
            "correct": bool(is_correct) if is_correct is not None else None,
        }
    return ans

def _find_best_result(db: Session, user_id: str, quiz_id: int) -> Result | None:
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
    items = db.query(QuizItem).filter(QuizItem.quiz_id == quiz_id).order_by(QuizItem.id.asc()).all()
    rows: List[Dict[str, Any]] = []
    answers_map: Dict[int, Dict[str, Any]] = {}

    if best:
        answers_map = _load_result_answers_if_exist(db, best.id)

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

    payload: Dict[str, Any] = {
        "quiz_id": q.id,
        "title": q.title,
        "mode": q.mode,
        "score": float(best.score) if best else None,
        "taken_at": str(best.taken_at) if best else None,
        "items": rows,
    }
    return payload

@router.get("/{quiz_id}/best")
def best_attempt_review(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Return a normalized 'best attempt' review for this quiz.
    - If per-item answers exist in `result_answers`, include them
    - Otherwise, return explanations-only (correct answers + why)
    Never raises if answers table is missing.
    """
    return _assemble_review(db, user, quiz_id)
