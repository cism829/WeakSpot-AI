
from sqlalchemy import Column, Integer, ForeignKey, String, Text, DateTime, func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Note(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    content_text = Column(Text, nullable=True)
    status = Column(String(50), default="uploaded")  # uploaded -> ocr_done -> analyzed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="notes")
    quizzes = relationship("Quiz", back_populates="note", cascade="all, delete-orphan")
