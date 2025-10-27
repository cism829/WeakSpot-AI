from sqlalchemy import Column, Text, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from app.core.db import Base

class NoteRepair(Base):
    __tablename__ = "note_repairs"
    repair_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    note_id   = Column(UUID(as_uuid=True), ForeignKey("notes.note_id", ondelete="CASCADE"), index=True, nullable=False)

    # snapshot & suggestion
    original_text  = Column(Text, nullable=False)
    suggested_text = Column(Text, nullable=True)
    suggestion_log = Column(JSONB, nullable=True)  # list of {sentence_original, sentence_repaired, fills}

    status    = Column(String(16), nullable=False, server_default=text("'pending'"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
