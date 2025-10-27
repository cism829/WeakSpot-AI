from sqlalchemy import Column, Integer, ForeignKey, Text, Boolean, Index
from sqlalchemy.orm import relationship
from app.core.db import Base

class ResultAnswer(Base):
    __tablename__ = "result_answers"
    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("results.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("quiz_items.id", ondelete="CASCADE"), nullable=False, index=True)
    user_answer = Column(Text, nullable=True)  # store index as str or exact text
    is_correct = Column(Boolean, default=False, nullable=False)
    
    item = relationship("QuizItem")
    result = relationship("Result", back_populates="answers")
    
