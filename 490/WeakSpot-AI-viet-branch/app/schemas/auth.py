from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

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

class PrivacyIn(BaseModel):
    public_profile: bool
    public_leaderboard: bool

class AlertsIn(BaseModel):
    new_device: bool = True
    password_change: bool = True
    twofa_change: bool = True

class PasswordIn(BaseModel):
    current: str
    new: str = Field(min_length=8)

class SecurityOut(BaseModel):
    twoFAEnabled: bool
    privacy: PrivacyIn
    alerts: AlertsIn
    sessions: List[dict]

class TOTPStartOut(BaseModel):
    secret: str
    otpauth: str
    qr: Optional[str] = None  # base64 data URL (optional)

class TOTPConfirmIn(BaseModel):
    code: str

class TOTPConfirmOut(BaseModel):
    ok: bool
    backup_codes: List[str]