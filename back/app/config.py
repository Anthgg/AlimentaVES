import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


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
