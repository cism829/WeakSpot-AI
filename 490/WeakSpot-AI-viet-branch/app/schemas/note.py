
from pydantic import BaseModel

class NoteOut(BaseModel):
    id: str
    status: str
    content_text: str | None = None
    class Config: from_attributes = True
