from sqlalchemy import Column, Text, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func, text
from app.models.base import Base
from sqlalchemy.orm import relationship
class NoteAnalysis(Base):
    __tablename__ = "note_analysis"
    analysis_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    note_id     = Column(UUID(as_uuid=True), ForeignKey("notes.note_id", ondelete="CASCADE"), index=True, nullable=False)

    subject = Column(String(128), nullable=True)
    summary = Column(Text, nullable=True)
    blocks  = Column(JSONB, nullable=True)      
    flags   = Column(JSONB, nullable=True)      
    meta    = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    note = relationship("Note", back_populates="analyses")