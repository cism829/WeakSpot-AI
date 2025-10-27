from typing import List, Optional, Literal
from pydantic import BaseModel, Field

QuizType = Literal["mcq", "short_answer", "fill_blank", "true_false"]

class GenerateBase(BaseModel):
    user_id: int = 1
    subject: str = "general"
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    mode: Literal["practice", "exam"] = "practice"
    num_items: int = Field(10, ge=1, le=50)
    types: List[QuizType] = ["mcq"]  # which item types to include

class GenerateWithoutNote(GenerateBase):
    pass

class GenerateWithNote(GenerateBase):
    note_text: str

class QuizItemOut(BaseModel):
    id: int
    question: str
    type: QuizType
    choices: Optional[list] = None
    explanation: Optional[str] = None

class QuizOut(BaseModel):
    id: int
    title: str
    difficulty: str
    mode: str
    created_at: str
    items: List[QuizItemOut]

class SubmitPayload(BaseModel):
    score: float
    time_spent_sec: int = 0

class UserMCQ(BaseModel):
    item_id: int
    type: Literal["mcq"]
    choice_index: int

class UserTF(BaseModel):
    item_id: int
    type: Literal["true_false"]
    text: str  # "True"/"False" or truthy words

class UserFill(BaseModel):
    item_id: int
    type: Literal["fill_blank", "short_answer"]
    text: str

UserAnswer = UserMCQ | UserTF | UserFill

class GradePayload(BaseModel):
    answers: List[UserAnswer]
    time_spent_sec: int = 0
