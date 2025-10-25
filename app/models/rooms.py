from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, LargeBinary, func
from sqlalchemy.orm import relationship
from app.models.base import Base


class Rooms(Base):
    __tablename__ = "rooms"
    room_id = Column(Integer, primary_key=True, index=True)
    room_name = Column(String, unique=True)
    room_subject = Column(String)
    description = Column(String)
    is_private = Column(String, default="public")
    password = Column(String, nullable=True)

    messages = relationship("Messages", back_populates="room")