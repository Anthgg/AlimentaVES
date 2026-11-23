"""API contracts for kitchen requests against existing donations."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RequestStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class DonationRequestDecision(str, Enum):
    approved = "approved"
    rejected = "rejected"


class DonationRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kitchen_id: int = Field(ge=1)


class DonationRequestReview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: DonationRequestDecision


class DonationRequestOut(BaseModel):
    id: UUID
    donation_id: UUID
    kitchen_id: int
    requested_by: UUID
    status: RequestStatus
    submitted_at: datetime
    reviewed_by: UUID | None
    reviewed_at: datetime | None
    donation_status: str
