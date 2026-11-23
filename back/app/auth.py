"""Password hashing and bearer-token validation for API authentication."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import secrets
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError

from . import database as db
from .config import jwt_access_token_expire_minutes, jwt_secret

JWT_ALGORITHM = "HS256"
_password_hasher = PasswordHasher(type=Type.ID)
_dummy_password_hash = _password_hasher.hash(secrets.token_urlsafe(32))
_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    id: UUID
    email: str
    role: str
    created_at: datetime
    token_jti: UUID
    token_expires_at: datetime


def hash_password(password: str) -> str:
    """Hash a password using Argon2id with argon2-cffi defaults."""
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def dummy_password_hash() -> str:
    """Return a process-local hash for timing-safe unknown-email logins."""
    return _dummy_password_hash


def create_access_token(user_id: UUID) -> tuple[str, UUID, datetime, int]:
    issued_at = int(datetime.now(timezone.utc).timestamp())
    expires_in = jwt_access_token_expire_minutes() * 60
    expires_at_timestamp = issued_at + expires_in
    expires_at = datetime.fromtimestamp(expires_at_timestamp, timezone.utc)
    token_jti = uuid4()
    payload = {
        "sub": str(user_id),
        "jti": str(token_jti),
        "iat": issued_at,
        "exp": expires_at_timestamp,
    }
    token = jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)
    return token, token_jti, expires_at, expires_in


def unauthorized_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales no válidas o sesión vencida",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized_error()

    signing_secret = jwt_secret()
    try:
        claims = jwt.decode(
            credentials.credentials,
            signing_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "jti", "iat", "exp"]},
        )
        user_id = UUID(claims["sub"])
        token_jti = UUID(claims["jti"])
        expires_at = datetime.fromtimestamp(int(claims["exp"]), timezone.utc)
    except (PyJWTError, KeyError, TypeError, ValueError, OverflowError, OSError):
        raise unauthorized_error() from None

    user = db.get_active_auth_user(user_id, token_jti)
    if user is None:
        raise unauthorized_error()

    return AuthenticatedUser(
        id=user["id"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"],
        token_jti=token_jti,
        token_expires_at=expires_at,
    )
