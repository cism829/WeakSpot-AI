from datetime import datetime, timedelta
from typing import Optional     
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.db import get_db
from app.models.user import User
from typing import Annotated, Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(sub: str, expires_minutes: int = settings.JWT_EXPIRE_MINUTES) -> str:
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode = {"exp": expire, "sub": str(sub)}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt

# --- helper to accept header OR cookie ---
def token_from_header_or_cookie(request: Request, bearer: Optional[str] = Depends(oauth2_scheme)):
    # If Swagger/clients sent "Authorization Bearer <token>", use it
    print("inside token_from_header_or_cookie")
    if bearer:
        return bearer
    
    # Otherwise try cookie
    tok = request.cookies.get("access_token")
    if not tok:
        print("no token")
        raise HTTPException(status_code=401, detail="Not authenticated----")
    
    return tok

def get_current_user(
    token: Annotated[str, Depends(token_from_header_or_cookie)],
    db: Annotated[Session, Depends(get_db)]
) -> User:    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token.replace("Bearer ", ""), settings.JWT_SECRET, algorithms=["HS256"])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    return user