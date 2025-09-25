from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# from app.core.db import Base, engine
from app.models.database import Base, engine
from app.api.auth import router as auth_router
from app.api import groupchat

from app.models.chat import User, Rooms, Messages

Base.metadata.create_all(bind=engine)
print('created tables')

app = FastAPI(title="AI Tutor - Backend", version="1.0.0")

# allow the Vite dev server
origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health():
    return {"status": "ok"}

app.include_router(auth_router)
app.include_router(groupchat.router)


