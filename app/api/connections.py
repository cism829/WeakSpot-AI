from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Dict, Any
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.tutor import Tutor
from app.models.professor import Professor
from app.models.connection_request import ConnectionRequest

router = APIRouter(prefix="/connections", tags=["connections"])

def _enrich_request(r: ConnectionRequest, db: Session) -> Dict[str, Any]:
    # who sent it (always a student in our flow)
    u = db.query(User).filter(User.id == r.user_id).first()
    sender = {
        "id": getattr(u, "id", None),
        "first_name": getattr(u, "first_name", ""),
        "last_name": getattr(u, "last_name", ""),
        "email": getattr(u, "email", ""),
    }

    # summarize the target (tutor/professor)
    target_summary = {"type": r.target_type, "id": r.target_id}
    if r.target_type == "tutor":
        t = db.query(Tutor).options(joinedload(Tutor.user)).get(r.target_id)
        if t and t.user:
            target_summary.update({
                "first_name": t.user.first_name, "last_name": t.user.last_name, "email": t.user.email
            })
    elif r.target_type == "professor":
        p = db.query(Professor).options(joinedload(Professor.user)).get(r.target_id)
        if p and p.user:
            target_summary.update({
                "first_name": p.user.first_name, "last_name": p.user.last_name, "email": p.user.email
            })

    return {
        "id": r.id,
        "target_type": r.target_type,
        "target_id": r.target_id,
        "message": r.message,
        "preferred_time": r.preferred_time,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "from_user": sender,
        "target": target_summary,
    }

@router.get("/mine")
def my_connections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (db.query(ConnectionRequest)
            .filter(ConnectionRequest.user_id == current_user.id)
            .order_by(ConnectionRequest.created_at.desc())
            .all())
    return [_enrich_request(r, db) for r in rows]

def _owned_target_ids(db: Session, current_user: User):
    t = db.query(Tutor).filter(Tutor.user_id == current_user.id).first()
    p = db.query(Professor).filter(Professor.user_id == current_user.id).first()
    return (t.id if t else None), (p.id if p else None)

@router.get("/incoming")
def my_incoming(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tutor_id, professor_id = _owned_target_ids(db, current_user)
    if not tutor_id and not professor_id:
        return []
    q = db.query(ConnectionRequest)
    conds = []
    if tutor_id:
        conds.append((ConnectionRequest.target_type == "tutor") & (ConnectionRequest.target_id == tutor_id))
    if professor_id:
        conds.append((ConnectionRequest.target_type == "professor") & (ConnectionRequest.target_id == professor_id))
    rows = q.filter(conds[0] if len(conds)==1 else (conds[0] | conds[1])) \
            .order_by(ConnectionRequest.created_at.desc()) \
            .all()
    return [_enrich_request(r, db) for r in rows]

def _assert_can_act(r: ConnectionRequest, db: Session, current_user: User):
    if r.target_type == "tutor":
        t = db.query(Tutor).get(r.target_id)
        if not t or t.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed")
    elif r.target_type == "professor":
        p = db.query(Professor).get(r.target_id)
        if not p or p.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed")

@router.post("/{request_id}/accept")
def accept_request(request_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(ConnectionRequest).get(request_id)
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    _assert_can_act(r, db, current_user)
    r.status = "accepted"
    db.commit(); db.refresh(r)
    return _enrich_request(r, db)

@router.post("/{request_id}/decline")
def decline_request(request_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(ConnectionRequest).get(request_id)
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    _assert_can_act(r, db, current_user)
    r.status = "declined"
    db.commit(); db.refresh(r)
    return _enrich_request(r, db)
