import os
import secrets
from urllib.parse import urlsplit
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_PROCESS_JWT_SECRET = secrets.token_urlsafe(48)


def is_production() -> bool:
    return os.getenv("APP_ENV", "development").strip().lower() == "production"


def database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Se necesita DATABASE_URL para conectar a PostgreSQL")
    return url


def database_sslmode() -> str:
    configured = os.getenv("DATABASE_SSLMODE")
    allowed = {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}
    if configured:
        value = configured.strip().lower()
        if value not in allowed:
            raise RuntimeError("DATABASE_SSLMODE no contiene un modo SSL válido")
        return value

    host = urlsplit(database_url()).hostname
    local_hosts = {"localhost", "127.0.0.1", "::1", "db", "postgres"}
    return "disable" if host in local_hosts else "require"


def _positive_int(name: str, default: int, *, maximum: int) -> int:
    raw_value = os.getenv(name, str(default))
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} debe ser un entero positivo") from exc
    if value < 1 or value > maximum:
        raise RuntimeError(f"{name} debe estar entre 1 y {maximum}")
    return value


def database_pool_min_size() -> int:
    return _positive_int("DB_POOL_MIN_SIZE", 1, maximum=20)


def database_pool_max_size() -> int:
    value = _positive_int("DB_POOL_MAX_SIZE", 4, maximum=20)
    if value < database_pool_min_size():
        raise RuntimeError("DB_POOL_MAX_SIZE no puede ser menor que DB_POOL_MIN_SIZE")
    return value


def database_pool_timeout_seconds() -> int:
    return _positive_int("DB_POOL_TIMEOUT_SECONDS", 10, maximum=120)


def auto_create_schema() -> bool:
    default = "0" if is_production() else "1"
    return os.getenv("AUTO_CREATE_SCHEMA", default).strip().lower() in {
        "1", "true", "yes", "on"
    }


def demo_seed_enabled() -> bool:
    return os.getenv("DEMO_SEED", "0").strip() == "1"


def cors_origins() -> list[str]:
    value = os.getenv("FRONTEND_ORIGINS")
    if value is None:
        if is_production():
            return []
        value = "http://localhost:5173,http://127.0.0.1:5173"
    return [origin.strip() for origin in value.split(",") if origin.strip()]


def jwt_secret() -> str:
    """Use a configured key or a process-local random key for local demos."""
    value = os.getenv("JWT_SECRET")
    if not value:
        if is_production():
            raise RuntimeError("JWT_SECRET debe configurarse mediante Secret Manager")
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


def media_storage_backend() -> str:
    backend = os.getenv("MEDIA_STORAGE_BACKEND", "local").strip().lower()
    if backend not in {"local", "gcs"}:
        raise RuntimeError("MEDIA_STORAGE_BACKEND debe ser local o gcs")
    return backend


def gcs_bucket_name() -> str:
    return os.getenv("GCS_BUCKET_NAME", "").strip()


def validate_runtime_settings() -> None:
    if not is_production():
        return
    jwt_secret()
    database_url()
    if database_sslmode() not in {"require", "verify-ca", "verify-full"}:
        raise RuntimeError("La conexión PostgreSQL de producción debe usar TLS")
    origins = cors_origins()
    if not origins or "*" in origins:
        raise RuntimeError("FRONTEND_ORIGINS debe enumerar orígenes autorizados")
    if auto_create_schema():
        raise RuntimeError("AUTO_CREATE_SCHEMA debe estar desactivado en producción")
    if demo_seed_enabled():
        raise RuntimeError("DEMO_SEED debe estar desactivado en producción")
    if media_storage_backend() != "gcs" or not gcs_bucket_name():
        raise RuntimeError("Producción requiere un bucket GCS privado configurado")
    database_pool_max_size()
