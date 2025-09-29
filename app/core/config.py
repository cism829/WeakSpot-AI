import os
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional
from pydantic import SecretStr
load_dotenv()

class Settings(BaseModel):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./test.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your_jwt_secret_key")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    CORS_ORIGINS: list[str] = [
        os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
        "http://127.0.0.1:5173",
    ]
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")
    COIN_PER_QUIZ: int = int(os.getenv("COIN_PER_QUIZ", "1"))
    EXAM_COST_COINS: int = int(os.getenv("EXAM_COST_COINS", "5"))
settings = Settings()