from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

users = {
    "Collin": {
        "id": 1,
        "username": "cism829"
    },
    "Mike": {
        "id": 2,
        "username": "m234"
    }
}

rooms = {
    1: {
        "room_id": 1,
        "subject": "Math",
        "description": "something random for testing short description"
    },
    2: {
        "room_id": 2,
        "subject": "Science",
        "description": "another something random for testing short description"
    },
    3: {
        "room_id": 3,
        "subject": "English",
        "description": "aljfhakufhawo faourfjalf srunflajsf something random for testing short description"
    }
}

def get_User(user_id: str):
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


@app.get("/", response_class=HTMLResponse)
async def get(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws/{room}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room: str, client_id: str):
    user = get_User(client_id)
    if (user):
        username = user["username"]
    else:
        username = "guest"
    await manager.connect(websocket, room)
    await manager.broadcast(f"User {username} has entered Room {room}", room)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"You: {data}", websocket)
            await manager.broadcast(f"User {username}: {data}", room, websocket)
    except WebSocketDisconnect: 
        manager.disconnect(websocket, room)
        await manager.broadcast(f"User {username} has left Room {room}", room, sender=websocket)

