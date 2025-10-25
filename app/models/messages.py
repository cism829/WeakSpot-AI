from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.models.base import Base


class Messages(Base):
    __tablename__ = "messages"
    message_id = Column(Integer, primary_key=True, index=True)
    message_text = Column(String, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    room_id = Column(Integer, ForeignKey("rooms.room_id"))

    user = relationship("User", back_populates="messages")
    room = relationship("Rooms", back_populates="messages")