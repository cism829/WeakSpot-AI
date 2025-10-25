from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, LargeBinary, func
from sqlalchemy.orm import relationship
from app.models.base import Base



class RoomInfo(Base):
    __tablename__ = "room_info"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.room_id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    has_access = Column(Boolean, default=False)

    room = relationship("Rooms")
    user = relationship("User")
