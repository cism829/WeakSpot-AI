from sqlalchemy import Column, String, Integer, ForeignKey, Float, DateTime, func, Index
from sqlalchemy.orm import relationship
from app.models.base import Base

class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, default=0.0, nullable=False)
    time_spent_sec = Column(Integer, default=0, nullable=False)
    taken_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Optional: relationships (wire these only if your Quiz/User models have back_populates)
    quiz = relationship("Quiz", back_populates="results")
    user = relationship("User", back_populates="results")
    answers = relationship(
        "ResultAnswer",
        back_populates="result",
        cascade="all, delete-orphan",
        passive_deletes=True,
        )
# Helpful composite index for listing attempts quickly
Index("ix_results_user_quiz_time", Result.user_id, Result.quiz_id, Result.taken_at.desc())
    