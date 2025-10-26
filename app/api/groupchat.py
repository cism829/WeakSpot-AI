# app/api/groupchat.py

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.chat import Rooms, Messages
from app.models.user import User

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_key: str):
        await websocket.accept()
        self.active_connections.setdefault(room_key, []).append(websocket)

    def disconnect(self, websocket: WebSocket, room_key: str):
        if room_key in self.active_connections:
            lst = self.active_connections[room_key]
            if websocket in lst:
                lst.remove(websocket)
            if not lst:
                del self.active_connections[room_key]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str, room_key: str, sender: WebSocket | None = None):
        for connection in self.active_connections.get(room_key, []):
            if connection is not sender:
                await connection.send_text(message)

manager = ConnectionManager()

def get_user(session: Session, user_id: str):
    return session.query(User).filter(User.id == user_id).first()

def get_room(session: Session, room_id: int):
    return session.query(Rooms).filter(Rooms.room_id == room_id).first()

@router.get("/rooms")
def get_rooms(db: Session = Depends(get_db)):
    rooms = db.query(Rooms).all()
    return [{"room_id": r.room_id, "room_name": r.room_name, "room_subject": r.room_subject, "description": r.description} for r in rooms]

@router.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    session = SessionLocal()

    # user_id is a UUID string
    user = get_user(session, client_id)
    if not user:
        user = User(id=client_id, username=f"guest_{client_id}", first_name="Guest", last_name="", password="!", email=f"{client_id}@guest.local")
        session.add(user)
        session.commit()
        session.refresh(user)

    # room_id arrives as str; DB expects int
    try:
        room_id_int = int(room_id)
    except ValueError:
        await websocket.close(code=1000)
        return

    room = get_room(session, room_id_int)
    if not room:
        await websocket.close(code=1000)
        return

    # Load previous messages for this room
    previous_messages = (
        session.query(Messages)
        .filter(Messages.room_id == room.room_id)
        .order_by(Messages.timestamp)
        .all()
    )

    room_key = str(room.room_id)
    await manager.connect(websocket, room_key)

    for msg in previous_messages:
        # assumes Messages has relationship to User as `user`
        await websocket.send_text(f"{msg.user.username}: {msg.message_text}")

    await manager.broadcast(f"---User {user.username} has entered Room {room_key}---", room_key)

    try:
        while True:
            data = await websocket.receive_text()

            message = Messages(message_text=data, user_id=user.id, room_id=room.room_id)
            session.add(message)
            session.commit()

            await manager.send_personal_message(f"You: {data}", websocket)
            await manager.broadcast(f"{user.username}: {data}", room_key, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_key)
        await manager.broadcast(f"---User {user.username} has left Room {room_key}---", room_key)
