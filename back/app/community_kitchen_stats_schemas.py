"""Response models for community-kitchen statistics."""

from pydantic import BaseModel, Field


class CommunityKitchenStatsOut(BaseModel):
    total: int = Field(description="Total community kitchens stored in PostgreSQL.")
    located: int = Field(
        description="Records with both latitude and longitude coordinates."
    )
    district_count: int = Field(
        description="Distinct non-empty districts, compared case-insensitively."
    )
    status_breakdown: dict[str, int] = Field(
        description=(
            "Counts by source status. Blank or missing source statuses use "
            "the key 'unknown'."
        )
    )
    records_with_reported_users: int = Field(
        description="Records with a non-null user count reported by the source."
    )
    source_reported_users_total: int = Field(
        description=(
            "Sum of non-null source-reported user counts; this is not a count "
            "of unique people."
        )
    )
