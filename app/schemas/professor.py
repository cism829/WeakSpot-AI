from pydantic import BaseModel, Field
from typing import List, Optional
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
class OfficeHourIn(BaseModel):
    day: Optional[str] = ""
    start: Optional[str] = ""
    end: Optional[str] = ""
    location: Optional[str] = ""

class ProfessorUpsert(BaseModel):
    # all optional so no 422 if some are missing
    department: Optional[str] = ""
    bio: Optional[str] = ""
    courses: Optional[List[str]] = []
    office_hours: Optional[List[OfficeHourIn]] = []
    rating: Optional[float] = 0.0
    # allow clients that pass user_id explicitly (e.g., admin tools)
    user_id: Optional[str] = None
    
class ProfessorSearchIn(BaseModel):
    q: Optional[str] = None
    dept: Optional[str] = None
    page: Optional[int] = None
    page_size: Optional[int] = None
    