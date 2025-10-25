# app/schemas/study_groups.py
from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field

# ---------- ROOMS ----------
class RoomCreateIn(BaseModel):
    room_name: str
    room_subject: str | None = None
    description: str | None = None
    is_private: str = "public"
    password: str | None = None
    
class RoomOut(BaseModel):
    room_id: int
    room_name: str
    room_subject: Optional[str] = None
    description: Optional[str] = None

class RoomCreateOut(RoomOut):
    pass  # same fields as RoomOut

class RoomAccessOut(BaseModel):
    has_access: bool
    # present when has_access is False (so the UI knows to prompt for password)
    is_private: Optional[str] = Field(default=None, description='"public" | "private"')

class VerifyAccessOut(BaseModel):
    access: str  # "granted"

class VerifyAccessIn(BaseModel):
    password: str
# ---------- MESSAGES ----------
class MessageOut(BaseModel):
    message_id: int
    message_text: str
    user_id: int
    timestamp: str  # ISO (from DB server_default=func.now())
    room_id: int
    username: Optional[str] = None  # convenient for history

# If you ever need to return a list in one payload (not required now):
class MessageListOut(BaseModel):
    items: List[MessageOut]

# ---------- FILES ----------
class FileUploadOut(BaseModel):
    file_id: int
    filename: str
class FileUploadIn(BaseModel):
    filename: str
    content_type: str | None = None
    data_b64: str