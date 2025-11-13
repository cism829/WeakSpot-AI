from pydantic import BaseModel
from typing import Optional

class ConnectionCreate(BaseModel):
    message: str = ""
    preferred_time: Optional[str] = None

class ConnectionOut(BaseModel):
    id: str
    user_id: str
    target_type: str
    target_id: str
    message: str
    preferred_time: str | None
    status: str
