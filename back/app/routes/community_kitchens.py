from fastapi import APIRouter, HTTPException, Path, Query

from .. import database as db
from ..community_kitchen_schemas import CommunityKitchenOut

router = APIRouter(prefix="/community-kitchens", tags=["Comedores populares"])


@router.get("", response_model=list[CommunityKitchenOut])
def list_community_kitchens(
    name: str | None = Query(default=None, min_length=1, max_length=254),
    district: str | None = Query(default=None, min_length=1, max_length=120),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return db.list_community_kitchens(name, district, limit, offset)


@router.get("/{kitchen_id}", response_model=CommunityKitchenOut)
def get_community_kitchen(kitchen_id: int = Path(ge=1)):
    kitchen = db.get_community_kitchen(kitchen_id)
    if kitchen is None:
        raise HTTPException(status_code=404, detail="Comedor no encontrado")
    return kitchen
