from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field, field_validator

class DonationStatus(str, Enum):
    available = "available"
    reserved = "reserved"
    delivered = "delivered"

class DonationCreate(BaseModel):
    donor_name: str = Field(min_length=2, max_length=100)
    food_name: str = Field(min_length=2, max_length=120)
    quantity_kg: float = Field(gt=0, le=10000)
    pickup_address: str = Field(min_length=4, max_length=200)
    expires_at: datetime
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("expires_at")
    @classmethod
    def future_expiration(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("expires_at debe incluir zona horaria")
        if value <= datetime.now(timezone.utc):
            raise ValueError("expires_at debe ser una fecha futura")
        return value

class DonationOut(BaseModel):
    id: str
    donor_name: str
    food_name: str
    quantity_kg: float
    pickup_address: str
    expires_at: datetime
    notes: str | None
    status: DonationStatus
    reserved_by: str | None
    created_at: datetime
    delivered_at: datetime | None

class ReservationCreate(BaseModel):
    reserved_by: str = Field(min_length=2, max_length=120)

class StatsOut(BaseModel):
    available: int
    reserved: int
    delivered: int
    kilograms_delivered: float
    estimated_servings: int
