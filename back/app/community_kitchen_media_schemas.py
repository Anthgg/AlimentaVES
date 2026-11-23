from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class PhotoCategory(str, Enum):
    profile = "profile"
    cover = "cover"
    gallery = "gallery"
    food = "food"


class PhotoDecision(str, Enum):
    approved = "approved"
    rejected = "rejected"


class PhotoOut(BaseModel):
    id: UUID
    kitchen_id: int
    profile_id: UUID
    category: PhotoCategory
    content_type: str
    size_bytes: int
    width: int
    height: int
    status: str
    url: str
    uploaded_at: str


class PhotoReviewIn(BaseModel):
    decision: PhotoDecision
