"""Administrator-only operational views."""

from fastapi import APIRouter, Depends, Query

from .. import database as db
from ..auth import AuthenticatedUser, get_current_user
from ..admin_schemas import AdminUserOut

router = APIRouter(prefix="/admin", tags=["Administración"])


def require_admin(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    from fastapi import HTTPException

    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol administrador")
    return current_user


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    role: str | None = Query(default=None, pattern="^(donor|kitchen|admin)$"),
    _admin: AuthenticatedUser = Depends(require_admin),
):
    """List account summaries without password hashes or session tokens."""
    with db.connect() as conn:
        if role is None:
            rows = conn.execute(
                """SELECT id, email, role, is_active, created_at
                   FROM auth_users ORDER BY created_at DESC, id LIMIT %s OFFSET %s""",
                (limit, offset),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT id, email, role, is_active, created_at
                   FROM auth_users WHERE role = %s
                   ORDER BY created_at DESC, id LIMIT %s OFFSET %s""",
                (role, limit, offset),
            ).fetchall()
    return rows


@router.get("/community-kitchens")
def list_kitchens(
    name: str | None = Query(default=None, min_length=1, max_length=254),
    district: str | None = Query(default=None, min_length=1, max_length=120),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _admin: AuthenticatedUser = Depends(require_admin),
):
    """List official catalog records for administrative review."""
    return db.list_community_kitchens(name, district, limit, offset)


@router.get("/donations")
def list_admin_donations(
    status: str | None = Query(default=None, pattern="^(available|reserved|delivered)$"),
    _admin: AuthenticatedUser = Depends(require_admin),
):
    """Read donations for administrative oversight."""
    return db.list_donations(status)
