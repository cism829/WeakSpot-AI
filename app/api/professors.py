from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.professor import Professor
from app.models.user import User
from app.schemas.professor import ProfessorOut, ProfessorCreate
import json

router = APIRouter(prefix="/professors", tags=["professors"])

def _j(s, default):
    try:
        return json.loads(s) if s else default
    except Exception:
        return default

def serialize_prof_row(p: Professor) -> ProfessorOut:
    """Serialize when a Professor row exists."""
    u = p.user
    if not u:
        raise HTTPException(status_code=500, detail="Professor row missing linked user")
    return ProfessorOut(
        id=p.id,
        user_id=u.id,
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        department=p.department or "",
        bio=p.bio or "",
        courses=_j(p.courses, []),
        office_hours=_j(p.office_hours, []),
        rating=p.rating or 0.0,
    )

def serialize_from_user_only(p: Professor, u: User) -> ProfessorOut:
    """Return a valid ProfessorOut using only User info (no Professor row yet)."""
    return ProfessorOut(
        id="",                     # no professor row yet
        user_id=u.id,
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        department=p.department or "",
        bio=p.bio or "",
        courses=p.courses or [],
        office_hours=p.office_hours or [],
        rating= p.rating or 0.0, 
    )

@router.get("/me", response_model=ProfessorOut)
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Try to find professor row for the current user
    p = (
        db.query(Professor)
        .options(joinedload(Professor.user))
        .filter(Professor.user_id == current_user.id)
        .first()
    )
    if p:
        return serialize_prof_row(p)
    # No professor row yet: still return user info in ProfessorOut shape
    return serialize_from_user_only(current_user)

@router.get("/{user_id}", response_model=ProfessorOut)
def get_professor(user_id: str, db: Session = Depends(get_db)):
    """
    IMPORTANT: {user_id} is a User.id — not Professor.id.
    The frontend passes the authenticated user's id here.
    """
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    p = (
        db.query(Professor)
        .options(joinedload(Professor.user))
        .filter(Professor.user_id == user_id)
        .first()
    )
    if p:
        return serialize_prof_row(p)

    # No professor profile yet — return User-based shape so the page can load
    return serialize_from_user_only(u)

@router.post("", response_model=ProfessorOut)
def upsert_professor(
    payload: ProfessorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Professor).filter(Professor.user_id == current_user.id).first()
    data = {
        "department": payload.department or "",
        "bio": payload.bio or "",
        "courses": json.dumps(payload.courses or []),
        "office_hours": json.dumps(payload.office_hours or []),
        "rating": payload.rating or 0.0,
    }
    if p:
        for k, v in data.items():
            setattr(p, k, v)
    else:
        p = Professor(user_id=current_user.id, **data)
        db.add(p)
    db.commit()
    db.refresh(p)
    return serialize_prof_row(p)
