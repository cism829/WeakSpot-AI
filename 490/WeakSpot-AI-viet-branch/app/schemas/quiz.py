
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Union


class MCQ(BaseModel):
    type: Literal["mcq"]
    question: str
    choices: List[str] = Field(min_length=2)  # we'll trim to 4 later
    answer_index: int
    explanation: Optional[str] = None

class ShortAnswer(BaseModel):
    type: Literal["short_answer"]
    question: str
    answer_text: str
    explanation: Optional[str] = None

class FillBlank(BaseModel):
    type: Literal["fill_blank"]
    question: str
    answer_text: str
    explanation: Optional[str] = None

class TrueFalse(BaseModel):
    type: Literal["true_false"]
    question: str
    # model sometimes returns True/False (bool), sometimes strings — accept both
    answer_text: Union[Literal["True","False"], bool]
    explanation: Optional[str] = None

Item = Union[MCQ, ShortAnswer, FillBlank, TrueFalse]
class QuizItems(BaseModel):
    items: List[Item]