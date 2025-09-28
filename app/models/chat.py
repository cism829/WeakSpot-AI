from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, LargeBinary, func
from sqlalchemy.orm import relationship
from app.models.database import Base
import datetime


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)

    messages = relationship("Messages", back_populates="user")


class Rooms(Base):
    __tablename__ = "rooms"
    room_id = Column(Integer, primary_key=True, index=True)
    room_name = Column(String, unique=True)
    room_subject = Column(String)
    description = Column(String)

    messages = relationship("Messages", back_populates="room")


class Messages(Base):
    __tablename__ = "messages"
    message_id = Column(Integer, primary_key=True, index=True)
    message_text = Column(String, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    room_id = Column(Integer, ForeignKey("rooms.room_id"))

    user = relationship("User", back_populates="messages")
    room = relationship("Rooms", back_populates="messages")


class File(Base):
    __tablename__= 'files'
    file_id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)  # e.g., "application/pdf"
    data = Column(LargeBinary, nullable=False)     # store raw bytes in DB
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"))
    room_id = Column(Integer, ForeignKey("rooms.room_id"))
    user = relationship("User")
    room = relationship("Rooms")
