# app/api/rooms.py

from fastapi import APIRouter, Depends, Form, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.chat import Rooms, RoomInfo

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/rooms")
def list_rooms(
    q: str | None = Query(None, description="Optional search on name/subject"),
    db: Session = Depends(get_db),
):
    query = db.query(Rooms)
    if q:
        like = f"%{q}%"
        query = query.filter((Rooms.room_name.ilike(like)) | (Rooms.room_subject.ilike(like)))
    rows = query.order_by(Rooms.room_id.desc()).all()
    # Return [] when there are no rooms (200 OK)
    return [
        {
            "room_id": r.room_id,
            "room_name": r.room_name,
            "room_subject": r.room_subject,
            "description": r.description,
            "is_private": r.is_private,   # "public" | "private"
        }
        for r in rows
    ]
    
@router.post("/rooms")
def create_room(
    room_name: str = Form(...),
    room_subject: str = Form(...),
    description: str = Form(...),
    is_private: str = Form("public"),
    password: str | None = Form(None),
    db: Session = Depends(get_db),
):
    existing_room = db.query(Rooms).filter(Rooms.room_name == room_name).first()
    if existing_room:
        raise HTTPException(status_code=400, detail="Room already exists")

    new_room = Rooms(
        room_name=room_name,
        room_subject=room_subject,
        description=description,
        is_private=is_private,
        password=password if is_private == "private" else None,
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return {
        "room_id": new_room.room_id,
        "room_name": new_room.room_name,
        "room_subject": new_room.room_subject,
        "description": new_room.description,
    }

@router.get("/rooms/{id}")
def get_room(id: int, db: Session = Depends(get_db)):
    room = db.query(Rooms).filter(Rooms.room_id == id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return {
        "room_id": room.room_id,
        "room_name": room.room_name,
        "room_subject": room.room_subject,
        "description": room.description,
        "is_private": room.is_private,
    }

@router.post("/rooms/{room_id}/verify")
def verify_room_access(
    room_id: int,
    user_id: str = Form(...),        # <-- string UUID
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    room = db.query(Rooms).filter(Rooms.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.is_private == "private" and room.password != password:
        raise HTTPException(status_code=403, detail="Invalid password")

    entry = db.query(RoomInfo).filter(
        RoomInfo.room_id == room_id,
        RoomInfo.user_id == user_id,  # <-- string compare
    ).first()
    if not entry:
        entry = RoomInfo(room_id=room_id, user_id=user_id, has_access=True)
        db.add(entry)
    else:
        entry.has_access = True

    db.commit()
    return {"access": "granted"}

@router.get("/rooms/{room_id}/access")
def check_access(room_id: int, user_id: str, db: Session = Depends(get_db)):
    room = db.query(Rooms).filter(Rooms.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    entry = db.query(RoomInfo).filter(
        RoomInfo.room_id == room_id,
        RoomInfo.user_id == user_id,  
    ).first()

    if entry and entry.has_access:
        return {"has_access": True, "is_private": room.is_private}

    return {"has_access": False, "is_private": room.is_private}
