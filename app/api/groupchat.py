from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

users = {
    "Collin": {
        "id": 1,
        "username": "cism829"
    },
    "Mike": {
        "id": 2,
        "username": "m234"
    },
    "Caleb":{
        "id": 3,
        "username": "something"
    },
    "Monroe":{
        "id": 4,
        "username": "mon40"
    },
    "Mario":{
        "id": 5,
        "username": "monster88"
    },
    "Luigi":{
        "id": 7,
        "username": "greenie44"
    },
    "Link":{
        "id": 10,
        "username": "Epona64"
    },
    "Pit":{
        "id": 512,
        "username": "Flightless98"
    },
}

def get_User(user_id: int):
    for name, info in users.items():
        if info["id"] == user_id:
            return info
    return None

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = []
        self.active_connections[room].append(websocket)
        return True

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

@router.websocket("/ws/{room}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room: str, client_id: int):
    user = get_User(client_id)
    if (user):
        username = user["username"]
    else:
        username = "guest"
    await manager.connect(websocket, room)
    await manager.broadcast(f"---User {username} has entered Room {room}---", room)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"You: {data}", websocket)
            await manager.broadcast(f"User {username}: {data}", room, websocket)
    except WebSocketDisconnect: 
        manager.disconnect(websocket, room)
        await manager.broadcast(f"---User {username} has left Room {room}---", room, sender=websocket)

