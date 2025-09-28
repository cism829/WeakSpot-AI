from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_users
from app.schemas.auth import RegisterIn, LoginIn, TokenOut
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])
@router.post("/register", status_code=status.HTTP_200_OK)
def register(user_in: RegisterIn, db: Session = Depends(get_db)):
    username = user_in.username.lower()
    email = user_in.email.lower()
    
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
        password=hashed_password
    )
    db.add(new_user)
    db.commit()

    return HTTPException(status_code=status.HTTP_200_OK, detail="User registered successfully")

@router.post("/login", response_model=TokenOut)
def login(login_in: LoginIn, db: Session = Depends(get_db)):
    username_or_email = login_in.username_or_email.lower()
    user = db.query(User).filter((User.username == username_or_email) | (User.email == username_or_email)).first()
    
    # Verify user and password
    if not user or not verify_password(login_in.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    # Create JWT token
    access_token = create_access_token(str(user.id))
    
    # Return TokenOut
    return TokenOut(access_token=access_token)

@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_users)):
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email}