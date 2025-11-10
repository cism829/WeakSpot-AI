import uuid
from sqlalchemy import Column, String, Text, Float
from app.models.base import Base
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

class Professor(Base):
    __tablename__ = "professors"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    department = Column(String, default="")
    bio = Column(Text, default="")
    courses = Column(Text, default="[]")          # JSON array
    office_hours = Column(Text, default="[]")     # JSON array of {day, start, end, location}
    rating = Column(Float, default=0.0)

    user = relationship("User", back_populates="professors")
