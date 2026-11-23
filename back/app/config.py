import os
from pathlib import Path
from dotenv import load_dotenv

BACK_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACK_DIR / ".env")

def db_path() -> str:
    return os.getenv("ALIMENTAVES_DB_PATH", str(BACK_DIR / "alimenta_ves.db"))

def demo_seed_enabled() -> bool:
    return os.getenv("DEMO_SEED", "0") == "1"

def cors_origins() -> list[str]:
    value = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [origin.strip() for origin in value.split(",") if origin.strip()]
