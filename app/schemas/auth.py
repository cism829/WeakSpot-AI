from pydantic import BaseModel, EmailStr

class RegisterIn(BaseModel):
    username: str
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: str
    grade_level: str | None = None
class LoginIn(BaseModel):
    username_or_email: str
    password: str

