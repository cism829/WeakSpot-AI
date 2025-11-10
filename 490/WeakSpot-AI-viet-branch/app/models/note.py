
from sqlalchemy import Column, text, Integer, ForeignKey, String, Text, DateTime, func
from sqlalchemy.orm import relationship
from app.models.base import Base
from sqlalchemy.dialects.postgresql import UUID
class Note(Base):
    __tablename__ = "notes"
    note_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    og_text = Column(Text, nullable=True)
    status = Column(String(50), default="uploaded")  # uploaded -> ocr_done -> analyzed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="notes")
    quizzes = relationship("Quiz", back_populates="note", cascade="all, delete-orphan")
    flashcards = relationship(
        "Flashcard",
        back_populates="note"
    )
    chunks = relationship("NoteChunk", back_populates="note")
    analyses = relationship("NoteAnalysis", back_populates="note")
    repairs = relationship("NoteRepair", back_populates="note")
    
