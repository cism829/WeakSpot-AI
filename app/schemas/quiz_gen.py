from pydantic import BaseModel, Field
from typing import Optional

class QuizGenRequest(BaseModel):
    user_id: str = Field(..., description="ID of the user generating the quiz")
    note_id: Optional[int] = Field(None)
    subject: Optional[str] = Field(None)
    difficulty: Optional[str] = Field(None)
    mode: str = Field("practice", description="practice|exam")
    num_items: int = Field(10, ge=1, le=50)

class QuizGenResponse(BaseModel):
    quiz_id: int
