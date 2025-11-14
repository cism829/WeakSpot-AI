from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import Optional, List
import json

from app.core.db import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.tutor import Tutor
from app.models.connection_request import ConnectionRequest
from app.schemas.tutor import TutorOut, TutorCreate, TutorSearchOut, TutorUpsert, TutorStudentOut, TutorStudentMini
from app.schemas.connection import ConnectionCreate, ConnectionOut

router = APIRouter(prefix="/tutors", tags=["tutors"])

def _j(s: str | None, default):
    try:
        return json.loads(s) if s else default
    except Exception:
        return default

# -------- Serializers --------
def serialize_tutor_row(t: Tutor) -> TutorOut:
    """Serialize when a Tutor row exists."""
    u = t.user; 
    if not u:
        raise HTTPException(status_code=500, detail="Tutor row missing linked user")
    return TutorOut(
        id=t.id,
        user_id=u.id,
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        bio=t.bio or "",
        subjects=_j(t.subjects, []),
        hourly_rate=t.hourly_rate or 0.0,
        rating=t.rating or 0.0,
        availability=_j(t.availability, []),
    )

def serialize_from_user_only(u: User) -> TutorOut:
    """Return a valid TutorOut using only User info (no Tutor row yet)."""
    return TutorOut(
        id="",                     # no tutor row yet
        user_id=u.id,
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        bio="",
        subjects=[],
        hourly_rate=0.0,
        rating=0.0,
        availability=[],
    )

# -------- Endpoints --------
@router.get("", response_model=TutorSearchOut)
def list_tutors(
    q: Optional[str] = Query(None, description="Search first/last/email/bio/subjects"),
    subject: Optional[str] = Query(None, description="Filter by subject"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Lists ONLY users who already have a Tutor profile.
    """
    qs = db.query(Tutor).options(joinedload(Tutor.user)).join(Tutor.user)
    if q:
        like = f"%{q}%"
        qs = qs.filter(
            or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                User.email.ilike(like),
                Tutor.bio.ilike(like),
                Tutor.subjects.ilike(like),
                Tutor.availability.ilike(like),
            )
        )
    if subject:
        like = f"%{subject}%"
        qs = qs.filter(Tutor.subjects.ilike(like))

    rows = qs.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [serialize_tutor_row(t) for t in rows]}

@router.get("/{user_id}", response_model=TutorOut)
def get_tutor(user_id: str, db: Session = Depends(get_db)):
    """
    IMPORTANT: {user_id} is a User.id — not Tutor.id.
    The frontend passes the authenticated user's id here.
    If a Tutor row doesn't exist yet for this user, return a valid TutorOut
    built from the User record so the page can render immediately.
    """
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    t = (
        db.query(Tutor)
        .options(joinedload(Tutor.user))
        .filter(Tutor.user_id == user_id)
        .first()
    )
    if t:
        return serialize_tutor_row(t)

    # No tutor profile yet — return User-based shape (no 404)
    return serialize_from_user_only(u)

@router.post("", response_model=TutorOut)
def create_or_update_my_tutor_profile(
    tutor_in: TutorUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owner_id = tutor_in.user_id or current_user.id
    t = db.query(Tutor).filter(Tutor.user_id == owner_id).first()
    payload = {
        "bio": (tutor_in.bio or "").strip(),
        "subjects": json.dumps(tutor_in.subjects or []),
        "hourly_rate": float(tutor_in.hourly_rate or 0.0),
        "rating": float(tutor_in.rating or 0.0),
        "availability": json.dumps(tutor_in.availability or []),
    }
    if t:
        for k, v in payload.items():
            setattr(t, k, v)
    else:
        t = Tutor(user_id=owner_id, **payload)
        db.add(t)
    db.commit()
    db.refresh(t)
    return serialize_tutor_row(t)

@router.get("/me/students", response_model=List[TutorStudentOut])
def list_my_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all students who have an ACCEPTED connection to the
    currently logged-in tutor.
    """
    # Find the Tutor row that belongs to this user
    tutor = (
        db.query(Tutor)
        .filter(Tutor.user_id == current_user.id)
        .first()
    )
    if not tutor:
        # This account has no tutor profile yet -> no students
        return []

    # Find all accepted requests that target THIS tutor profile
    rows = (
        db.query(ConnectionRequest)
        .filter(
            ConnectionRequest.target_type == "tutor",
            ConnectionRequest.target_id == tutor.id,
            ConnectionRequest.status == "accepted",
        )
        .order_by(ConnectionRequest.created_at.desc())
        .all()
    )

    result: list[TutorStudentOut] = []
    for r in rows:
        u = r.user  # relationship from ConnectionRequest -> User
        if not u:
            continue

        result.append(
            TutorStudentOut(
                connection_id=r.id,
                since=r.created_at.isoformat() if r.created_at else None,
                student=TutorStudentMini(
                    id=u.id,
                    first_name=u.first_name,
                    last_name=u.last_name,
                    email=u.email,
                ),
            )
        )

    return result

@router.post("/{target_id}/request", response_model=ConnectionOut)
def request_tutor(
    target_id: str,
    req: ConnectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a connection request to a tutor.
    target_id may be either a Tutor.id (preferred, from list_tutors) or a User.id.
    We first try Tutor.id; if not found, fall back to User.id -> Tutor row.
    """
    # try as Tutor.id
    t = db.query(Tutor).get(target_id)
    if not t:
        # try as User.id
        t = db.query(Tutor).filter(Tutor.user_id == target_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tutor not found")

    c = ConnectionRequest(
        user_id=current_user.id,
        target_type="tutor",
        target_id=t.id,  # store Tutor.id to keep things consistent
        message=req.message or "",
        preferred_time=req.preferred_time or "",
        status="pending",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return ConnectionOut(
        id=c.id,
        user_id=c.user_id,
        target_type=c.target_type,
        target_id=c.target_id,
        message=c.message,
        preferred_time=c.preferred_time,
        status=c.status,
    )
