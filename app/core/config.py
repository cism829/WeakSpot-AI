# app/core/config.py

import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

def normalize_pg_url(url: str) -> str:
    if not url:
        return url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://") and "+psycopg" not in url and "+psycopg2" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url

def parse_bool(val: str | None, default: bool = False) -> bool:
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "t", "yes", "y", "on"}

def parse_cors(origins_env: str | None, default_list: list[str]) -> list[str]:
    if not origins_env:
        return default_list
    parts = [o.strip() for o in origins_env.split(",") if o.strip()]
    return parts or default_list

class Settings(BaseModel):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://app:app@localhost:5432/app",
    )

    JWT_SECRET: str = os.getenv("JWT_SECRET", "your_jwt_secret_key")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    CORS_ORIGINS: list[str] = parse_cors(
        os.getenv("CORS_ORIGINS"),
        [os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"), "http://127.0.0.1:5173"],
    )

    COOKIE_SECURE: bool = parse_bool(os.getenv("COOKIE_SECURE", "false"))
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")

    COIN_PER_QUIZ: int = int(os.getenv("COIN_PER_QUIZ", "1"))
    EXAM_COST_COINS: int = int(os.getenv("EXAM_COST_COINS", "5"))

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

settings = Settings()
settings.DATABASE_URL = normalize_pg_url(settings.DATABASE_URL)

# ❗ Enforce Postgres only
if not settings.DATABASE_URL.startswith("postgresql"):
    raise RuntimeError(
        "Postgres is required. Set DATABASE_URL like "
        "'postgresql+psycopg://user:pass@host:5432/dbname'"
    )
