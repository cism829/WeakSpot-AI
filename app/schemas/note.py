
from pydantic import BaseModel

class NoteOut(BaseModel):
    id: int
    filename: str
    status: str
    content_text: str | None = None
    class Config: from_attributes = True
