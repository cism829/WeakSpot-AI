from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

@router.get("/")
def leaderboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Order by coins_earned_total desc, then total_points desc
    rows = (
        db.query(User.username, User.coins_earned_total, User.total_points)
        .order_by(User.coins_earned_total.desc(), User.total_points.desc())
        .limit(50)
        .all()
    )
    return [{"rank": i+1, "username": u, "coins": c, "points": p} for i, (u, c, p) in enumerate(rows)]
