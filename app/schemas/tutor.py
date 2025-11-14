from pydantic import BaseModel
from typing import List, Optional
from pydantic.networks import EmailStr


class TutorBase(BaseModel):
    # who owns this tutor profile
    user_id: str
    # basic user info
    first_name: str
    last_name: str
    email: EmailStr
    # tutor details
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
    # optional: allow admin to create/edit for another user
    user_id: Optional[str] = None

class TutorStudentMini(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr


class TutorStudentOut(BaseModel):
    connection_id: str
    since: Optional[str] = None
    student: TutorStudentMini
