import uuid
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from app.models.base import Base
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey

class ConnectionRequest(Base):
    __tablename__ = "connection_requests"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String, nullable=False)      # 'tutor' or 'professor'
    target_id = Column(String, nullable=False)
    message = Column(Text, default="")
    preferred_time = Column(String, default="")       # ISO string
    status = Column(String, default="pending")        # pending, accepted, declined
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="connection_requests")
