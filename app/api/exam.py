from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/exams", tags=["exams"])

@router.post("/start")
def start_exam(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cost = settings.EXAM_COST_COINS
    if (user.coins_balance or 0) < cost:
        raise HTTPException(status_code=400, detail=f"Not enough coins. Need {cost}.")
    user.coins_balance -= cost
    db.commit()
    return {"ok": True, "coins_balance": user.coins_balance, "cost": cost}
