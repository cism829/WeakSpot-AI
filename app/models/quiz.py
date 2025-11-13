from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, func 
from sqlalchemy.orm import relationship
from app.models.base import Base
from sqlalchemy.dialects.postgresql import UUID
class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    note_id = Column(UUID(as_uuid=True), ForeignKey("notes.note_id", ondelete="CASCADE"), index=True, nullable=True)
    topic = Column(String(255), nullable=True)
    title = Column(String(255), nullable=False, default="Generated Quiz")

    difficulty = Column(String(50), default="medium")
    mode = Column(String(20), default="practice")  # practice | exam

    # where did this quiz come from? ("ai_general" or "ai_note")
    source = Column(String(20), default="ai_general")

    # comma-separated selected types for this quiz (e.g. "mcq,short_answer")
    types = Column(String(200), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="quizzes")
    items = relationship("QuizItem", back_populates="quiz", cascade="all, delete-orphan")
    note = relationship("Note", back_populates="quizzes")
    results = relationship("Result", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("Attempt", back_populates="quiz", cascade="all, delete-orphan")