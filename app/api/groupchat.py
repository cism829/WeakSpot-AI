from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.chat import User, Rooms, Messages

router = APIRouter()
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


manager = ConnectionManager()  # keep your existing connection manager

def get_user(session: Session, user_id: int):
    return session.query(User).filter(User.id == user_id).first()

def get_or_create_room(session: Session, room_name: str):
    room = session.query(Rooms).filter(Rooms.room_name == room_name).first()
    if not room:
        room = Rooms(room_name=room_name)
        session.add(room)
        session.commit()
        session.refresh(room)
    return room

@router.websocket("/ws/{room_name}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_name: str, client_id: int):
    session = SessionLocal()
    
    user = get_user(session, client_id)
    if not user:
        user = User(id=client_id, username=f"guest_{client_id}")
        session.add(user)
        session.commit()
        session.refresh(user)
    
    room = get_or_create_room(session, room_name)

    # Load previous messages
    previous_messages = session.query(Messages).filter(Messages.room_id == room.room_id).order_by(Messages.timestamp).all()

    await manager.connect(websocket, room_name)

    for msg in previous_messages:
        await websocket.send_text(f"{msg.user.username}: {msg.message_text}")

    await manager.broadcast(f"---User {user.username} has entered Room {room_name}---", room_name)

    try:
        while True:
            data = await websocket.receive_text()
            
            # Save message to DB
            message = Messages(
                message_text=data,
                user_id=user.id,
                room_id=room.room_id
            )
            session.add(message)
            session.commit()
            
            await manager.send_personal_message(f"You: {data}", websocket)
            await manager.broadcast(f"{user.username}: {data}", room_name, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_name)
        await manager.broadcast(f"---User {user.username} has left Room {room_name}---", room_name)
