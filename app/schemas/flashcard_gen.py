from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class FlashcardItemOut(BaseModel):
    id: int
    front: str
    back: str
    hint: Optional[str] = None

class FlashcardOut(BaseModel):
    id: int
    title: str
    subject: str
    topic: str
    source: str
    items: List[FlashcardItemOut]

class GenerateBaseFC(BaseModel):
    user_id: int = 1
    subject: str = "general"
    topic: str = ""
    num_items: int = Field(10, ge=1, le=50)
    title: str = "Generated Flashcards"

class GenerateWithoutNoteFC(GenerateBaseFC):
    pass

class GenerateWithNoteFC(GenerateBaseFC):
    note_id: int
class FlashcardItemModel(BaseModel):
    front: str
    back: str
    hint: Optional[str] = None

class FlashcardItems(BaseModel):
    items: List[FlashcardItemModel]
