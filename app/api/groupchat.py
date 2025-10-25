from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.rooms import Rooms
from app.models.messages import Messages
from app.models.user import User
from app.schemas.study_groups import RoomOut, MessageOut
from app.core.db import get_db

router = APIRouter(prefix="/groupchat", tags=["groupchat"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = []
        self.active_connections[room].append(websocket)

    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.active_connections:
            self.active_connections[room].remove(websocket)
            if not self.active_connections[room]:
                del self.active_connections[room]

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str, room: str, sender: WebSocket = None):
        if room in self.active_connections:
            for connection in self.active_connections[room]:
                if connection is not sender:
                    await connection.send_text(message)


manager = ConnectionManager()  

def get_user(session: Session, user_id: int):
    return session.query(User).filter(User.id == user_id).first()

def get_room(session: Session, room_id: int):
    return session.query(Rooms).filter(Rooms.room_id == room_id).first()

@router.get("/rooms", response_model=list[RoomOut])
def get_rooms(db: Session = Depends(get_db)):
    rooms = db.query(Rooms).all()
    return [
        {
            "room_id": r.room_id,
            "room_name": r.room_name,
            "room_subject": r.room_subject,
            "description": r.description,
        }
        for r in rooms
    ]

@router.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: int):
    session = SessionLocal()
    
    user = get_user(session, user_id)
    if not user:
        user = User(id=user_id, username=f"guest_{user_id}")
        session.add(user)
        session.commit()
        session.refresh(user)
    
    room = get_room(session, room_id)
    if not room:
        await websocket.close(code=1000)
        return

    
    previous_messages = session.query(Messages).filter(Messages.room_id == room.room_id).order_by(Messages.timestamp).all()                 #bug that needs to be fixed

    await manager.connect(websocket, room_id)

    for msg in previous_messages:
        await websocket.send_text(f"{msg.user.username}: {msg.message_text}")

    await manager.broadcast(f"---User {user.username} has entered Room {room_id}---", room_id)

    try:
        while True:
            data = await websocket.receive_text()
            
            message = Messages(
                message_text=data,
                user_id=user.id,
                room_id=room.room_id
            )
            session.add(message)
            session.commit()
            
            await manager.send_personal_message(f"You: {data}", websocket)
            await manager.broadcast(f"{user.username}: {data}", room_id, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
        await manager.broadcast(f"---User {user.username} has left Room {room_id}---", room_id)
