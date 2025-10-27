from sqlalchemy import Column,Integer,Text,DateTime,ForeignKey,UniqueConstraint,Index,text

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import VECTOR
from app.core.db import Base


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
        nullable=False,
        index=True,
    )

    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    embedding = Column(VECTOR(1536), nullable=True)

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
