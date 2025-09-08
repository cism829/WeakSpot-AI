from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List, Any, Dict
from app.core.db import get_db
from app.models.quiz import Quiz
from app.models.quiz_item import QuizItem


router = APIRouter()

class GenPayload(BaseModel):
    user_id: int = 1
    subject: str
    difficulty: Optional[str] = Field(default="medium", pattern="^(easy|medium|hard)$")
    mode: Optional[str] = Field(default="practice", pattern="^(practice|exam)$")
    num_items: Optional[int] = 10