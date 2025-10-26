from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, LargeBinary, func
from sqlalchemy.orm import relationship
from app.models.base import Base
import datetime




class Rooms(Base):
    __tablename__ = "rooms"
    room_id = Column(Integer, primary_key=True, index=True)
    room_name = Column(String, unique=True)
    room_subject = Column(String)
    description = Column(String)
    is_private = Column(String, default="public")
    password = Column(String, nullable=True)

    messages = relationship("Messages", back_populates="room")


class Messages(Base):
    __tablename__ = "messages"
    message_id = Column(Integer, primary_key=True, index=True)
    message_text = Column(String, index=True)
    user_id = Column(# In the provided code snippet, `String` is being used as a data type from the
    # SQLAlchemy library to define columns in the database tables.
    String, ForeignKey("users.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    room_id = Column(Integer, ForeignKey("rooms.room_id"))

    user = relationship("User", back_populates="messages")
    room = relationship("Rooms", back_populates="messages")


class File(Base):
    __tablename__= 'files'
    file_id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)  
    data = Column(LargeBinary, nullable=False)     
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(String, ForeignKey("users.id"))
    room_id = Column(Integer, ForeignKey("rooms.room_id"))
    user = relationship("User")
    room = relationship("Rooms")

class RoomInfo(Base):
    __tablename__ = "roominfo"
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.room_id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    has_access = Column(Boolean, default=False)

    room = relationship("Rooms")
    user = relationship("User")
