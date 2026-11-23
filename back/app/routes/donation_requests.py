"""Authenticated requests for existing food donations."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from .. import database as db
from .. import donation_requests as requests_db
from ..auth import AuthenticatedUser, get_current_user
from ..donation_request_schemas import (
    DonationRequestCreate,
    DonationRequestOut,
    DonationRequestReview,
    RequestStatus,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Solicitudes de donación"])


def require_admin(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol administrador")
    return current_user


def _notify_reviewed_request(request: dict) -> None:
    """Send an internal notice when F11's notification module is installed."""
    try:
        from ..notifications import create_notification

        decision = request["status"]
        create_notification(
            request["requested_by"],
            f"donation_request_{decision}",
            "Solicitud de donación aprobada"
            if decision == "approved"
            else "Solicitud de donación rechazada",
            "Un administrador revisó tu solicitud de donación.",
            related_type="donation_request",
            related_id=str(request["id"]),
        )
    except ImportError:
        # F09 can be deployed independently; F11 supplies this module.
        return
    except Exception:
        # A notification failure must not roll back an already committed review.
        logger.exception("No se pudo crear la notificación de revisión")


def _notify_admins_new_request(request_id: UUID) -> None:
    """Notify admins through F11 when that module is present."""
    try:
        from ..notifications import notify_admins

        notify_admins(
            "donation_request_created",
            "Nueva solicitud de donación",
            "Se recibió una solicitud de donación y requiere revisión.",
            related_type="donation_request",
            related_id=str(request_id),
        )
    except ImportError:
        return
    except Exception:
        logger.exception("No se pudo avisar a los administradores")


@router.post(
    "/donations/{donation_id}/requests",
    response_model=DonationRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Solicitar una donación para un comedor autorizado",
)
def create_request(
    payload: DonationRequestCreate,
    donation_id: UUID = Path(),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if db.get_donation(str(donation_id)) is None:
        raise HTTPException(status_code=404, detail="Donación no encontrada")
    if db.get_community_kitchen(payload.kitchen_id) is None:
        raise HTTPException(status_code=404, detail="Comedor no encontrado")
    if not db.is_active_community_kitchen_member(payload.kitchen_id, current_user.id):
        raise HTTPException(
            status_code=403,
            detail="Se requiere membresía aprobada para solicitar en este comedor",
        )

    request = requests_db.create_request(
        donation_id, payload.kitchen_id, current_user.id
    )
    if request is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "La donación no está disponible, venció o ya existe una solicitud "
                "pendiente para este comedor"
            ),
        )
    _notify_admins_new_request(request["id"])
    return request


@router.get(
    "/donation-requests",
    response_model=list[DonationRequestOut],
    summary="Consultar el historial de solicitudes y entregas",
)
def list_requests(
    request_status: RequestStatus | None = Query(default=None, alias="status"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    account_id = None if current_user.role == "admin" else current_user.id
    return requests_db.list_requests(
        account_id, request_status.value if request_status is not None else None
    )


@router.get(
    "/donation-requests/{request_id}",
    response_model=DonationRequestOut,
    summary="Consultar una solicitud propia o una solicitud como admin",
)
def get_request(
    request_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    request = requests_db.get_request(request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if current_user.role != "admin" and request["requested_by"] != current_user.id:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return request


@router.get(
    "/admin/donation-requests",
    response_model=list[DonationRequestOut],
    summary="Listar solicitudes para moderación",
)
def list_admin_requests(
    request_status: RequestStatus | None = Query(default=None, alias="status"),
    _admin: AuthenticatedUser = Depends(require_admin),
):
    return requests_db.list_requests(
        status=request_status.value if request_status is not None else None
    )


@router.patch(
    "/admin/donation-requests/{request_id}/decision",
    response_model=DonationRequestOut,
    summary="Aprobar o rechazar una solicitud de donación",
)
def review_request(
    payload: DonationRequestReview,
    request_id: UUID = Path(),
    admin: AuthenticatedUser = Depends(require_admin),
):
    request, changed, conflict_reason, closed_requests = requests_db.review_request(
        request_id, payload.decision.value, admin.id
    )
    if request is None:
        if conflict_reason == "donation_unavailable":
            raise HTTPException(
                status_code=409,
                detail="La donación ya no está disponible o venció",
            )
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if not changed:
        raise HTTPException(status_code=409, detail="La solicitud ya fue revisada")
    _notify_reviewed_request(request)
    for closed in closed_requests:
        closed["status"] = "rejected"
        _notify_reviewed_request(closed)
    return request
