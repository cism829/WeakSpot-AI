from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user, make_backup_codes, hash_list
from app.schemas.auth import RegisterIn, LoginIn, SecurityOut, PrivacyIn, AlertsIn, PasswordIn, TOTPStartOut, TOTPConfirmIn, TOTPConfirmOut
from app.models.user import User
from app.core.config import settings
from typing import Annotated
try:
    import pyotp
except ImportError:
    pyotp = None
router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", status_code=status.HTTP_200_OK)
def register(user_in: RegisterIn, db: Session = Depends(get_db)):
    username = user_in.username.lower()
    email = user_in.email.lower()
    grade_level = user_in.grade_level
    # Check if user already exists
    existing_user = db.query(User).filter((User.username == username) | (User.email == email)).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email already registered")
    
    # If pass, hash the password and create the user
    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        username=username,
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        email=email,
        password=hashed_password,
        role= user_in.role,
        grade_level= grade_level
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    print(grade_level)
    return HTTPException(status_code=status.HTTP_200_OK, detail="User registered successfully")

@router.post("/login")
def login(login_in: LoginIn, response: Response, db: Session = Depends(get_db)):
    username_or_email = login_in.username_or_email.lower()
    user = db.query(User).filter((User.username == username_or_email) | (User.email == username_or_email)).first()
    
    # Verify user and password
    if not user or not verify_password(login_in.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    # Create JWT token
    access_token = create_access_token(str(user.id))
    
    # Set HttpOnly Cookie
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE, 
        max_age=60 * 60 * 24 * 7,  # 7 days
        path="/"
    )
        
    # Return user id, name, email
    return {"id": user.id, "username": user.username, "email": user.email, "grade_level": user.grade_level,
            "coins_earned_total": user.coins_earned_total, "coins_balance": user.coins_balance,
            "total_points": user.total_points}

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie("access_token", path="/login")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/me")
def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email, "grade_level": current_user.grade_level,
            "first_name": current_user.first_name, "last_name": current_user.last_name, "role": current_user.role,
            "coins_earned_total": current_user.coins_earned_total, "coins_balance": current_user.coins_balance,
            "total_points": current_user.total_points}
    
@router.get("/security", response_model=SecurityOut)
def get_security(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    sessions = [
        {"id": "current", "device": "This device", "ip": "0.0.0.0", "last": "Now", "current": True}
    ]
    return SecurityOut(
        twoFAEnabled=bool(getattr(user, "twofa_enabled", False)),
        privacy=PrivacyIn(
            public_profile=bool(getattr(user, "public_profile", False)),
            public_leaderboard=bool(getattr(user, "public_leaderboard", True)),
        ),
        alerts=AlertsIn(
            new_device=bool(getattr(user, "alerts_new_device", True)),
            password_change=bool(getattr(user, "alerts_password_change", True)),
            twofa_change=bool(getattr(user, "alerts_twofa_change", True)),
        ),
        sessions=sessions,
    )

@router.post("/privacy")
def update_privacy(payload: PrivacyIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.public_profile = payload.public_profile
    user.public_leaderboard = payload.public_leaderboard
    db.add(user); db.commit()
    return {"ok": True}

@router.post("/security/password")
def change_password(payload: PasswordIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(payload.current, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    user.password = get_password_hash(payload.new)
    # optional sign-out-others: bump token_version if your model has it
    if hasattr(user, "token_version"):
        user.token_version = (user.token_version or 0) + 1
    db.add(user); db.commit()
    return {"ok": True}

@router.post("/security/2fa/totp/start", response_model=TOTPStartOut)
def start_totp(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if pyotp is None:
        raise HTTPException(status_code=500, detail="pyotp is not installed on server.")
    secret = pyotp.random_base32()
    issuer = "WeakSpotAI"
    label = f"{issuer}:{user.email}"
    otpauth = pyotp.totp.TOTP(secret).provisioning_uri(name=label, issuer_name=issuer)
    user.twofa_secret = secret  # store but not enabled yet
    db.add(user); db.commit()
    return TOTPStartOut(secret=secret, otpauth=otpauth, qr=None)

@router.post("/security/2fa/totp/confirm", response_model=TOTPConfirmOut)
def confirm_totp(payload: TOTPConfirmIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if pyotp is None or not getattr(user, "twofa_secret", None):
        raise HTTPException(status_code=400, detail="TOTP enrollment not started.")
    totp = pyotp.TOTP(user.twofa_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code.")
    # return plaintext codes once; store hashed
    codes = _make_backup_codes()
    user.twofa_backup_codes = "\n".join(_hash_list(codes))
    user.twofa_enabled = True
    db.add(user); db.commit()
    return TOTPConfirmOut(ok=True, backup_codes=codes)

@router.post("/security/2fa/disable")
def disable_2fa(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.twofa_enabled = False
    user.twofa_secret = None
    user.twofa_backup_codes = None
    if hasattr(user, "token_version"):
        user.token_version = (user.token_version or 0) + 1
    db.add(user); db.commit()
    return {"ok": True}

@router.delete("/sessions/others")
def sign_out_others(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if hasattr(user, "token_version"):
        user.token_version = (user.token_version or 0) + 1
        db.add(user); db.commit()
    return {"ok": True}

@router.post("/security/alerts")
def update_alerts(payload: AlertsIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.alerts_new_device = payload.new_device
    user.alerts_password_change = payload.password_change
    user.alerts_twofa_change = payload.twofa_change
    db.add(user); db.commit()
    return {"ok": True}

from pydantic import BaseModel
class DeleteIn(BaseModel):
    confirm: str

@router.delete("")
def delete_account(payload: DeleteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.confirm != "DELETE":
        raise HTTPException(status_code=400, detail='Type "DELETE" to confirm.')
    db.delete(user); db.commit()
    return {"ok": True}