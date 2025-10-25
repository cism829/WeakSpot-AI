from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, LargeBinary, func
from sqlalchemy.orm import relationship
from app.models.base import Base

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