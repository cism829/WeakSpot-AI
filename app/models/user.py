import uuid
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.orm import relationship 
from app.models.base import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    password = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    role = Column(String, default="user")  # user or admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    quizzes = relationship("Quiz", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
