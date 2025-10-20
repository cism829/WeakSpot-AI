from fastapi import APIRouter, Depends, Form

from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.chat import User, Rooms, Messages, RoomInfo
from fastapi import HTTPException
router = APIRouter()
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/rooms")
def create_room(
    room_name: str = Form(...),
    room_subject: str= Form(...),
    description: str = Form(...),
    is_private: str = Form("public"),
    password: str = Form(None),
    db: Session = Depends(get_db)
):
    existing_room = db.query(Rooms).filter(Rooms.room_name == room_name).first()
    if existing_room:
        return {"error": "Room already exists"}
    
    new_room = Rooms(
        room_name = room_name,
        room_subject = room_subject,
        description = description,
        is_private=is_private,
        password=password if is_private == "private" else None
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return{
        "room_id": new_room.room_id,
        "room_name": new_room.room_name,
        "room_subject": new_room.room_subject,
        "description": new_room.description
    }

@router.post("/rooms/{room_id}/verify")
def verify_room_access(room_id: int, user_id: int = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    room = db.query(Rooms).filter(Rooms.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.is_private == "private" and room.password != password:
        raise HTTPException(status_code=403, detail="Invalid password")

    entry = db.query(RoomInfo).filter(RoomInfo.room_id == room_id, RoomInfo.user_id == user_id).first()
    if not entry:
        entry = RoomInfo(room_id=room_id, user_id=user_id, has_access=True)
        db.add(entry)
        print(f"Created new access entry for user {user_id} in room {room_id}")
    else:
        entry.has_access = True
        print(f"Updated access for user {user_id} in room {room_id}: {entry.has_access}")

    db.commit()
    return {"access": "granted"}

@router.get("/rooms/{room_id}/access")
def check_access(room_id: int, user_id: int, db: Session = Depends(get_db)):
    room = db.query(Rooms).filter(Rooms.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    entry = db.query(RoomInfo).filter(RoomInfo.room_id == room_id, RoomInfo.user_id == user_id).first()
    if entry and entry.has_access:
        return {"has_access": True}

    return {"has_access": False, "is_private": room.is_private}
