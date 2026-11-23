from fastapi import APIRouter
from ..database import get_stats
from ..schemas import StatsOut

router = APIRouter(tags=["Estadísticas"])

@router.get("/stats", response_model=StatsOut)
def stats():
    return get_stats()
