from __future__ import annotations

from datetime import datetime
from enum import Enum
import re
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


_EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_PERU_MOBILE_PATTERN = re.compile(
    r"(?<!\d)(?:\+?51[\s-]?)?9\d{2}(?:[\s-]?\d{3}){2}(?!\d)"
)
_PERU_LANDLINE_PATTERN = re.compile(
    r"(?<!\d)(?:\+51[\s-]?1|01)[\s-]?\d{3}[\s-]?\d{4}(?!\d)"
)
_LABELED_DNI_PATTERN = re.compile(
    r"\b(?:DNI|documento(?:\s+de\s+identidad)?)"
    r"\s*(?:n(?:[º°.]|ro\.?)?\s*)?[:#-]?\s*\d{8}\b",
    re.IGNORECASE,
)
_PROFILE_PRIVACY_WARNING = (
    "No incluyas nombres ni contactos de responsables, ni datos que identifiquen "
    "a beneficiarios. Usa solo información institucional; toda versión requiere "
    "revisión administrativa antes de publicarse."
)


class ClaimStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ProfileStatus(str, Enum):
    pending = "pending"
    published = "published"
    rejected = "rejected"


class ReviewDecision(str, Enum):
    approved = "approved"
    rejected = "rejected"


class ClaimRequestIn(BaseModel):
    """Empty request body; claim submissions must not contain free-form personal data."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "description": (
                "No admite nombres, contactos ni información identificable. "
                "La identidad del solicitante se toma del token autenticado."
            )
        },
    )


class ReviewIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: ReviewDecision


class CommunityKitchenClaimOut(BaseModel):
    id: UUID
    kitchen_id: int
    status: ClaimStatus
    submitted_at: datetime
    reviewed_at: datetime | None


class AdminCommunityKitchenClaimOut(CommunityKitchenClaimOut):
    account_id: UUID
    account_email: EmailStr
    kitchen_name: str
    reviewed_by: UUID | None


class CommunityKitchenProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    description: str | None = Field(max_length=2000, description=_PROFILE_PRIVACY_WARNING)
    operating_hours: str | None = Field(max_length=500, description=_PROFILE_PRIVACY_WARNING)
    institutional_location: str | None = Field(
        max_length=500,
        description=(
            "Publica solo ubicación institucional verificada; no uses domicilios "
            "personales. " + _PROFILE_PRIVACY_WARNING
        ),
    )
    needs: str | None = Field(max_length=2000, description=_PROFILE_PRIVACY_WARNING)

    @field_validator(
        "description",
        "operating_hours",
        "institutional_location",
        "needs",
    )
    @classmethod
    def reject_obvious_personal_identifiers(cls, value: str | None) -> str | None:
        if value is None:
            return None
        patterns = (
            _EMAIL_PATTERN,
            _PERU_MOBILE_PATTERN,
            _PERU_LANDLINE_PATTERN,
            _LABELED_DNI_PATTERN,
        )
        if any(pattern.search(value) for pattern in patterns):
            raise ValueError(
                "El perfil no debe incluir correos, teléfonos ni documentos de identidad"
            )
        return value

    @model_validator(mode="after")
    def require_profile_content(self) -> CommunityKitchenProfileIn:
        if not any((
            self.description,
            self.operating_hours,
            self.institutional_location,
            self.needs,
        )):
            raise ValueError("El perfil debe incluir al menos un campo")
        return self


class CommunityKitchenProfileOut(BaseModel):
    id: UUID
    kitchen_id: int
    description: str | None
    operating_hours: str | None
    institutional_location: str | None
    needs: str | None
    status: ProfileStatus
    submitted_at: datetime
    reviewed_at: datetime | None


class AdminCommunityKitchenProfileOut(CommunityKitchenProfileOut):
    kitchen_name: str
    submitted_by: UUID | None
    submitter_email: EmailStr | None
    reviewed_by: UUID | None
