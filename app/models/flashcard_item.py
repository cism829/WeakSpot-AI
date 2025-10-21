from sqlalchemy import Column, Integer, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from app.models.base import Base

class FlashcardItem(Base):
    __tablename__ = "flashcard_items"

    id = Column(Integer, primary_key=True, index=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id", ondelete="CASCADE"))
    front = Column(Text, nullable=False)  # term / question
    back = Column(Text, nullable=False)   # definition / answer
    hint = Column(Text, nullable=True)    # optional explanation or mnemonic

    flashcard = relationship("Flashcard", back_populates="items")
