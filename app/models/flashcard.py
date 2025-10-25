from sqlalchemy import Column, Integer, ForeignKey, String, DateTime, Text, func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(255), nullable=False, default="Generated Flashcards")
    subject = Column(String(100), default="general")
    topic = Column(String(100), default="")
    source = Column(String(20), default="ai_general")  # ai_general | ai_note
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="flashcards")
    note = relationship("Note", back_populates="flashcards")
    items = relationship("FlashcardItem", back_populates="flashcard", cascade="all, delete-orphan")
