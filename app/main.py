from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import engine, Base
from app.api.auth import router as auth_router
from app.models import Base, User, Note, Quiz, QuizItem, Result, ExamStart
from app.api.quizzes import router as quizzes_router 
from app.api.leaderboard import router as leaderboard_router
from app.api.exam import router as exam_router
Base.metadata.create_all(bind=engine)

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
app.include_router(quizzes_router)
app.include_router(leaderboard_router)
app.include_router(exam_router)