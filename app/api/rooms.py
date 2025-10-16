from fastapi import APIRouter, Depends, Form

from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.chat import User, Rooms, Messages

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
    db: Session = Depends(get_db)
):
    existing_room = db.query(Rooms).filter(Rooms.room_name == room_name).first()
    if existing_room:
        return {"error": "Room already exists"}
    
    new_room = Rooms(
        room_name = room_name,
        room_subject = room_subject,
        description = description
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