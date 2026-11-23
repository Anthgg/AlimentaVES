"""Request and response models for bearer-token authentication."""

from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, SecretStr, field_validator


class UserRole(str, Enum):
    donor = "donor"
    kitchen = "kitchen"
    admin = "admin"


class AuthCredentials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: SecretStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().casefold()

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: SecretStr) -> SecretStr:
        password = value.get_secret_value()
        if len(password) > 128:
            raise ValueError("La contraseña no puede superar 128 caracteres")
        return value


class RegisterIn(AuthCredentials):
    """Public registration always creates a donor, never a chosen role."""

    @field_validator("password")
    @classmethod
    def validate_registration_password(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 12:
            raise ValueError("La contraseña debe tener al menos 12 caracteres")
        return value


class LoginIn(AuthCredentials):
    pass


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    role: UserRole
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
