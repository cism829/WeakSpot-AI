from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict
from app.core.db import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.quiz import Quiz
from app.models.result import Result
from app.models.exam_start import ExamStart

router = APIRouter(prefix="/exams", tags=["exams"])

EXAM_COST = getattr(settings, "EXAM_COST_COINS", 5)

@router.get("/mine")
def list_my_exams(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Dict:
    # All exams you own
    exams = (
        db.query(Quiz)
        .filter(Quiz.user_id == user.id, func.lower(Quiz.mode) == "exam")
        .order_by(Quiz.created_at.desc())
        .all()
    )

    # Which of your exams have been started?
    started_qids = {
        qid
        for (qid,) in db.query(ExamStart.quiz_id).filter(ExamStart.user_id == user.id).all()
    }

    # Which have any results?
    completed_counts = dict(
        db.query(Result.quiz_id, func.count(Result.id))
        .filter(Result.user_id == user.id)
        .group_by(Result.quiz_id)
        .all()
    )

    pending, started, completed = [], [], []
    for q in exams:
        item = {
            "id": q.id,
            "title": q.title,
            "difficulty": q.difficulty,
            "created_at": str(q.created_at),
            "cost": EXAM_COST,
        }
        if q.id in completed_counts:
            completed.append(item)
        elif q.id in started_qids:
            started.append(item)
        else:
            pending.append(item)

    return {
        "pending": pending,
        "started": started,
        "completed": completed,
        "coins_balance": getattr(user, "coins_balance", 0) or 0,
        "exam_cost": EXAM_COST,
    }

@router.post("/{quiz_id}/start")
def start_exam(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Ensure this is your exam
    q = db.query(Quiz).filter(
        Quiz.id == quiz_id,
        Quiz.user_id == user.id,
        func.lower(Quiz.mode) == "exam"
    ).first()
    if not q:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Already started? (idempotent)
    existed = db.query(ExamStart).filter(
        ExamStart.user_id == user.id,
        ExamStart.quiz_id == quiz_id
    ).first()
    if existed:
        return {"ok": True, "already_started": True, "coins_balance": user.coins_balance, "cost": EXAM_COST}

    # Check coins
    bal = (user.coins_balance or 0)
    if bal < EXAM_COST:
        raise HTTPException(status_code=400, detail=f"Not enough coins. Need {EXAM_COST}.")

    # Deduct & mark started
    es = ExamStart(user_id=user.id, quiz_id=quiz_id)
    user.coins_balance = bal - EXAM_COST
    db.add(es)
    db.commit()

    return {"ok": True, "coins_balance": user.coins_balance, "cost": EXAM_COST}
