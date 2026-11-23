"""Schemas for read-only administration endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AdminUserOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    email: str
    role: str
    is_active: bool
    created_at: datetime
