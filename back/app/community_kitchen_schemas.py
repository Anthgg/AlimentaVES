from datetime import datetime

from pydantic import BaseModel


class CommunityKitchenOut(BaseModel):
    id: int
    source_code: str
    name: str
    district: str
    ubigeo: str
    address: str | None
    latitude: float | None
    longitude: float | None
    modality: str | None
    source_status: str | None
    users_count: int | None
    source_url: str
    downloaded_at: datetime
    verified_at: datetime | None
    created_at: datetime
    updated_at: datetime
