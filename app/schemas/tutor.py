from pydantic import BaseModel, Field
from typing import List, Optional
from pydantic.networks import EmailStr

class TutorBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    bio: str = ""
    subjects: List[str] = []
    hourly_rate: float = 0.0
    rating: float = 0.0
    availability: List[str] = []

class TutorOut(TutorBase):
    id: str

class TutorCreate(TutorBase):
    pass

class TutorSearchOut(BaseModel):
    items: List[TutorOut]
class TutorUpsert(BaseModel):
    bio: Optional[str] = ""
    subjects: Optional[List[str]] = []
    hourly_rate: Optional[float] = 0.0
    rating: Optional[float] = 0.0
    availability: Optional[List[str]] = []
    user_id: Optional[str] = None