from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
from app.schemas.auth import RegisterIn, LoginIn
from app.models.user import User
from app.core.config import settings
from typing import Annotated

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
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email,
            "first_name": current_user.first_name, "last_name": current_user.last_name, "role": current_user.role,
            "coins_earned_total": current_user.coins_earned_total, "coins_balance": current_user.coins_balance,
            "total_points": current_user.total_points}