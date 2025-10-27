from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.connection_request import ConnectionRequest

router = APIRouter(prefix="/connections", tags=["connections"])

@router.get("/mine")
def my_connections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (db.query(ConnectionRequest)
            .filter(ConnectionRequest.user_id == current_user.id)
            .order_by(ConnectionRequest.created_at.desc())
            .all())
    return [
        {
            "id": r.id,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "message": r.message,
            "preferred_time": r.preferred_time,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
