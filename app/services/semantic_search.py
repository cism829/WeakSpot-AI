from typing import List, Optional, Dict, Any
from sqlalchemy import text
from sqlalchemy.orm import Session
from openai import OpenAI

from app.core.config import settings

DEFAULT_MODEL = "text-embedding-3-small"

def embed_query(query: str, model: Optional[str] = None) -> list[float]:
    """Return embedding vector for a search query using OpenAI."""
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    model = model or DEFAULT_MODEL
    resp = client.embeddings.create(model=model, input=query)
    return resp.data[0].embedding

def semantic_search_best_chunk_per_note(
    db: Session,
    qemb: list[float],
    k: int = 10,
    threshold: float = 0.7,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Score all chunks via L2 distance (<=>), keep best chunk per note, filter, sort, limit.
    Returns rows with note_id, chunk_index, text, distance.
    """
    filters = ["c.embedding IS NOT NULL"]
    if user_id:
        filters.append("n.user_id = :user_id")

    sql = f"""
        WITH scored AS (
            SELECT
                c.note_id,
                c.chunk_index,
                c.text,
                (c.embedding::text::vector <=> (:qemb)::vector) AS distance
            FROM note_chunks c
            JOIN notes n ON n.note_id = c.note_id
            WHERE {" AND ".join(filters)}
        ),
        ranked AS (
            SELECT
                note_id,
                chunk_index,
                text,
                distance,
                ROW_NUMBER() OVER (PARTITION BY note_id ORDER BY distance ASC) AS rn
            FROM scored
        )
        SELECT
            note_id::text AS note_id,
            chunk_index,
            text,
            distance
        FROM ranked
        WHERE rn = 1
          AND distance <= :threshold
        ORDER BY distance ASC
        LIMIT :k;
    """
    rows = db.execute(
        text(sql),
        {"qemb": qemb, "threshold": threshold, "k": k, "user_id": user_id},
    ).mappings().all()

    return [dict(r) for r in rows]
