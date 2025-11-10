from typing import List, Optional
from uuid import UUID
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
    # Optional; we use get_current_user on the server anyway
    user_id: Optional[UUID] = None
    subject: str = "general"
    topic: str = ""
    num_items: int = Field(10, ge=1, le=50)
    title: str = "Generated Flashcards"

class GenerateWithoutNoteFC(GenerateBaseFC):
    pass

class GenerateWithNoteFC(GenerateBaseFC):
    # ✅ note_id is UUID
    note_id: UUID

class FlashcardItemModel(BaseModel):
    front: str
    back: str
    hint: Optional[str] = None

class FlashcardItems(BaseModel):
    items: List[FlashcardItemModel]
