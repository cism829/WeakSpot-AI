from pydantic import BaseModel, EmailStr

class RegisterIn(BaseModel):
    username: str
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    
class LoginIn(BaseModel):
    username_or_email: str
    password: str

#class TokenOut(BaseModel):
    #access_token: str
    #token_type: str = "bearer"