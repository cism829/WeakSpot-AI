import uuid
from sqlalchemy import Column, String, Integer, Float, Text
from sqlalchemy.orm import relationship
from app.models.base import Base
from sqlalchemy import ForeignKey
class Tutor(Base):
    __tablename__ = "tutors"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    bio = Column(Text, default="")
    subjects = Column(Text, default="")          # JSON array as text
    hourly_rate = Column(Float, default=0.0)
    rating = Column(Float, default=0.0)
    availability = Column(Text, default="[]")    # JSON array of available slots
 
    user = relationship("User", back_populates="tutors")