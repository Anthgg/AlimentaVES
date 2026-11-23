import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_PROCESS_JWT_SECRET = secrets.token_urlsafe(48)


def database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Se necesita DATABASE_URL para conectar a PostgreSQL")
    return url


def demo_seed_enabled() -> bool:
    return os.getenv("DEMO_SEED", "0") == "1"


def cors_origins() -> list[str]:
    value = os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    return [origin.strip() for origin in value.split(",") if origin.strip()]


def jwt_secret() -> str:
    """Use a configured key or a process-local random key for local demos."""
    value = os.getenv("JWT_SECRET")
    if not value:
        return _PROCESS_JWT_SECRET
    if len(value.encode("utf-8")) < 32:
        raise RuntimeError("JWT_SECRET debe tener al menos 32 bytes")
    return value


def jwt_access_token_expire_minutes() -> int:
    raw_value = os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    try:
        minutes = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES debe ser un entero positivo"
        ) from exc
    if minutes < 1:
        raise RuntimeError(
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES debe ser un entero positivo"
        )
    return minutes
