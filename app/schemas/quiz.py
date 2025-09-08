
from pydantic import BaseModel
from typing import Optional

class QuizItemOut(BaseModel):
    id: int
    question: str
    choices: Optional[str] = None
    answer: str
    type: str
    explanation: str | None = None
    class Config: from_attributes = True

class QuizOut(BaseModel):
    id: int
    title: str
    difficulty: str
    mode: str
    items: list[QuizItemOut]
    class Config: from_attributes = True
