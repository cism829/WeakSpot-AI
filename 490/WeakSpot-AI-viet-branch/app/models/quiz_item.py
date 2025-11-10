
from sqlalchemy import Column, Integer, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from app.models.base import Base


class QuizItem(Base):
    __tablename__ = "quiz_items"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"))
    question = Column(Text, nullable=False)
    choices = Column(Text, nullable=True)  # JSON string
    answer_index = Column(Integer, nullable=True)
    answer_text = Column(Text, nullable=True)
    type = Column(String(50), default="mcq")  # mcq | tf | fill
    explanation = Column(Text, nullable=True)

    # Relationship
    quiz = relationship("Quiz", back_populates="items")
