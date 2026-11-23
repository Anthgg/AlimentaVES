"""Community-kitchen metrics endpoint."""

from fastapi import APIRouter

from .. import database as db
from ..community_kitchen_stats_schemas import CommunityKitchenStatsOut

router = APIRouter(prefix="/community-kitchens", tags=["Comedores populares"])


@router.get(
    "/stats",
    response_model=CommunityKitchenStatsOut,
    summary="Estadísticas de comedores populares",
    description=(
        "Agrega directamente los registros guardados en PostgreSQL. La suma "
        "de usuarios refleja valores reportados por la fuente y no personas "
        "únicas; los estados vacíos aparecen como `unknown`."
    ),
)
def community_kitchen_stats():
    return db.get_community_kitchen_stats()
