from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import Base

class ExamStart(Base):
    __tablename__ = "exam_starts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # each user can start a given exam only once
    __table_args__ = (
        UniqueConstraint("user_id", "quiz_id", name="ux_exam_starts_user_quiz"),
    )

    quiz = relationship("Quiz")
    user = relationship("User")
