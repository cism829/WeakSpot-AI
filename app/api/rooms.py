from fastapi import APIRouter, Depends, Form

from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.roomInfo import RoomInfo
from app.models.rooms import Rooms
from fastapi import HTTPException
from app.schemas.study_groups import RoomCreateOut, RoomAccessOut, VerifyAccessOut, RoomCreateIn, VerifyAccessIn
from app.core.db import get_db
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("/create", response_model=RoomCreateOut)
def create_room(payload: RoomCreateIn, db: Session = Depends(get_db)):
    new_room = Rooms(
        room_name=payload.room_name,
        room_subject=payload.room_subject,
        description=payload.description,
        is_private=payload.is_private,
        password=payload.password
    )
    print("Creating new room:")
    db.add(new_room); db.commit(); db.refresh(new_room)
    return {
        "room_id": new_room.room_id,
        "room_name": new_room.room_name,
        "room_subject": new_room.room_subject,
        "description": new_room.description
    }

@router.post("/{room_id}/verify", response_model=VerifyAccessOut)
@router.post("/{room_id}/verify", response_model=VerifyAccessOut)
def verify_room_access(
    room_id: int,
    payload: VerifyAccessIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    room = db.query(Rooms).filter(Rooms.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.is_private == "private" and room.password != payload.password:
        raise HTTPException(status_code=403, detail="Invalid password")

    entry = db.query(RoomInfo).filter(
        RoomInfo.room_id == room_id,
        RoomInfo.user_id == user.id
    ).first()
    if not entry:
        entry = RoomInfo(room_id=room_id, user_id=user.id, has_access=True)
        db.add(entry)
    else:
        entry.has_access = True

    db.commit()
    return {"access": "granted"}

@router.get("/{room_id}/access", response_model=RoomAccessOut)
def check_access(
    room_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):    
    room = db.query(Rooms).filter(Rooms.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    entry = db.query(RoomInfo).filter(
        RoomInfo.room_id == room_id,
        RoomInfo.user_id == user.id
    ).first()    
    if entry and entry.has_access:
        return {"has_access": True}

    return {"has_access": False, "is_private": room.is_private}
