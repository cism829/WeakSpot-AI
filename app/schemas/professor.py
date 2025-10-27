from pydantic import BaseModel
from typing import List
from pydantic.networks import EmailStr

class ProfessorBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    department: str = ""
    bio: str = ""
    courses: List[str] = []
    office_hours: List[dict] = []
    rating: float = 0.0

class ProfessorOut(ProfessorBase):
    id: str

class ProfessorCreate(ProfessorBase):
    pass

class ProfessorSearchOut(BaseModel):
    items: List[ProfessorOut]
