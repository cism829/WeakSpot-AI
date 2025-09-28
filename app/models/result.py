
from sqlalchemy import Column, String, Integer, ForeignKey, Float, DateTime, func
from app.models.base import Base

class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, default=0.0)
    time_spent_sec = Column(Integer, default=0)
    taken_at = Column(DateTime(timezone=True), server_default=func.now())


