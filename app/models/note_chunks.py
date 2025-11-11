from sqlalchemy import Column,Integer,Text,DateTime,ForeignKey,UniqueConstraint,Index,text

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base

class NoteChunk(Base):
    __tablename__ = "note_chunks"

    chunk_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        nullable=False,
    )

    note_id = Column(
        UUID(as_uuid=True),
        ForeignKey("notes.note_id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    embedding = Column(JSONB, nullable=True)  # store list[float]

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    note = relationship("Note", back_populates="chunks")

    __table_args__ = (
        UniqueConstraint("note_id", "chunk_index", name="note_chunks_note_idx"),
        Index("note_chunks_note_id_idx", "note_id"),
    )

