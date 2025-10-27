
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.services.semantic_search import embed_query, semantic_search_best_chunk_per_note

router = APIRouter(prefix="/search", tags=["semantic-search"])

class SearchIn(BaseModel):
    query: str = Field(..., description="Search phrase")
    k: int = Field(10, ge=1, le=50)
    threshold: float = Field(0.7, ge=0.0)

class SearchOutItem(BaseModel):
    note_id: str
    chunk_index: int
    text: str
    distance: float

@router.post("", response_model=List[SearchOutItem])
def search_notes(
    body: SearchIn,
    db: Session = Depends(get_db),
    user_id: Optional[str] = Query(None, description="Optional filter to this user's notes (UUID)"),
):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="query cannot be empty")
    qemb = embed_query(body.query)
    rows = semantic_search_best_chunk_per_note(
        db, qemb=qemb, k=body.k, threshold=body.threshold, user_id=user_id
    )
    return rows
