
from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, func
from sqlalchemy.orm import relationship
from app.models.base import Base
class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False, default="Generated Quiz")
    difficulty = Column(String(50), default="medium")
    mode = Column(String(20), default="practice")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    items = relationship("QuizItem", back_populates="quiz", cascade="all, delete-orphan")
    user = relationship("User", back_populates="quizzes")
    note = relationship("Note", back_populates="quizzes")