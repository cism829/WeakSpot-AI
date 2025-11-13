from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.core.db import get_db
from app.core.security import get_current_user
from app.models.professor import Professor
from app.models.user import User
from app.schemas.professor import ProfessorOut, ProfessorCreate, ProfessorUpsert, ProfessorSearchOut, OfficeHourIn, ProfessorSearchIn
import json
from typing import Optional
from sqlalchemy import or_
from app.models.connection_request import ConnectionRequest
from app.schemas.connection import ConnectionCreate, ConnectionOut
router = APIRouter(prefix="/professors", tags=["professors"])

def _j(s, default):
    try:
        return json.loads(s) if s else default
    except Exception:
        return default

def serialize_prof_row(p: Professor) -> ProfessorOut:
    """Serialize when a Professor row exists."""
    u = p.user; 
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

def serialize_from_user_only(u: User) -> ProfessorOut:
    """Return a valid ProfessorOut using only User info (no Professor row yet)."""
    return ProfessorOut(
        id="",                     # no professor row yet
        user_id=u.id,
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        department="",
        bio="",
        courses=[],
        office_hours=[],
        rating=0.0,
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

@router.get("", response_model=ProfessorSearchOut)
def list_professors(
    q: Optional[str] = Query(None, description="Search first/last/email/bio/courses"),
    dept: Optional[str] = Query(None, description="Filter by department"),
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=200),
    db: Session = Depends(get_db),
):
    qs = db.query(Professor).options(joinedload(Professor.user)).join(Professor.user)

    if q:
        like = f"%{q}%"
        qs = qs.filter(
            or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                User.email.ilike(like),
                Professor.bio.ilike(like),
                Professor.courses.ilike(like),
            )
        )
    if dept:
        qs = qs.filter(Professor.department.ilike(f"%{dept}%"))

    if page and page_size:
        qs = qs.offset((page - 1) * page_size).limit(page_size)

    rows = qs.all()
    return {"items": [serialize_prof_row(p) for p in rows]}

@router.post("/search", response_model=ProfessorSearchOut)
def search_professors(body: ProfessorSearchIn, db: Session = Depends(get_db)):
    return list_professors(
        q=body.q, dept=body.dept, page=body.page, page_size=body.page_size, db=db
    )
    
@router.post("/{target_id}/request", response_model=ConnectionOut)
def request_professor(
    target_id: str,
    req: ConnectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a connection request to a professor.

    `target_id` may be either:
      - Professor.id (preferred — what the search list returns)
      - User.id (fallback — if you call with a user id)
    We always store the canonical Professor.id in ConnectionRequest.target_id.
    """
    # Try as Professor.id first
    p = db.query(Professor).get(target_id)
    if not p:
        # Fallback: treat path as User.id
        p = db.query(Professor).filter(Professor.user_id == target_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Professor not found")

    c = ConnectionRequest(
        user_id=current_user.id,
        target_type="professor",
        target_id=p.id,  # store Professor.id
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
    
@router.post("", response_model=ProfessorOut)
def upsert_professor(
    payload: ProfessorUpsert,                # ✅ all fields optional
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Professor).filter(Professor.user_id == current_user.id).first()

    # normalize courses to list[str]
    courses_list = payload.courses or []
    # normalize office_hours to list[dict] (handles Pydantic v1/v2 objects or plain dicts)
    oh_list = []
    for oh in (payload.office_hours or []):
        if hasattr(oh, "model_dump"):     # Pydantic v2
            oh_list.append(oh.model_dump())
        elif hasattr(oh, "dict"):         # Pydantic v1
            oh_list.append(oh.dict())
        else:
            oh_list.append(dict(oh))

    data = {
        "department": (payload.department or "").strip(),
        "bio": (payload.bio or "").strip(),
        "courses": json.dumps(courses_list),
        "office_hours": json.dumps(oh_list),
        "rating": float(payload.rating or 0.0),
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