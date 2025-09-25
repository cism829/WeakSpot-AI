from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, func
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