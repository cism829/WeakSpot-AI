from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import engine, Base
from app.api.auth import router as auth_router
from app.models import Base, User, Note, Quiz, QuizItem, Result, ExamStart
from app.api.quizzes import router as quizzes_router 
from app.api.leaderboard import router as leaderboard_router
from app.api.exam import router as exam_router
from app.api.review import router as review_router
from app.api.flashcards import router as flashcards_router
from app.api.groupchat import router as groupchat_router
from app.api.rooms import router as rooms_router
from app.api.fileUpload import router as fileupload_router
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
app.include_router(review_router)
app.include_router(flashcards_router)
app.include_router(groupchat_router)
app.include_router(rooms_router)
app.include_router(fileupload_router)