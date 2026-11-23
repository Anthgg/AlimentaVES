"""Moderated claims and public profiles for community kitchens."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from .. import database as db
from ..auth import AuthenticatedUser, get_current_user
from ..community_kitchen_profile_schemas import (
    AdminCommunityKitchenClaimOut,
    AdminCommunityKitchenProfileOut,
    ClaimRequestIn,
    ClaimStatus,
    CommunityKitchenClaimOut,
    CommunityKitchenProfileIn,
    CommunityKitchenProfileOut,
    ProfileStatus,
    ReviewIn,
)

router = APIRouter(tags=["Perfiles de comedores"])


def require_admin(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol administrador")
    return current_user


def require_kitchen(kitchen_id: int) -> None:
    if db.get_community_kitchen(kitchen_id) is None:
        raise HTTPException(status_code=404, detail="Comedor no encontrado")


@router.post(
    "/community-kitchens/{kitchen_id}/claims",
    response_model=CommunityKitchenClaimOut,
    status_code=status.HTTP_201_CREATED,
    summary="Solicitar la administración de un comedor",
    description=(
        "El cuerpo es vacío: no se aceptan nombres, contactos ni texto libre. "
        "La identidad proviene del token y la solicitud la debe revisar un admin."
    ),
)
def request_claim(
    _payload: ClaimRequestIn,
    kitchen_id: int = Path(ge=1),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    require_kitchen(kitchen_id)
    if db.is_active_community_kitchen_member(kitchen_id, current_user.id):
        raise HTTPException(status_code=409, detail="La cuenta ya es miembro activo")
    claim = db.create_community_kitchen_claim(kitchen_id, current_user.id)
    if claim is None:
        raise HTTPException(
            status_code=409, detail="Ya existe una solicitud pendiente para este comedor"
        )
    return claim


@router.get(
    "/community-kitchens/{kitchen_id}/profile",
    response_model=CommunityKitchenProfileOut,
    summary="Consultar el perfil publicado de un comedor",
)
def get_public_profile(kitchen_id: int = Path(ge=1)):
    profile = db.get_published_community_kitchen_profile(kitchen_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="No hay un perfil publicado")
    return profile


@router.put(
    "/community-kitchens/{kitchen_id}/profile",
    response_model=CommunityKitchenProfileOut,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enviar una versión del perfil para revisión",
    description=(
        "No incluyas nombres/contactos de responsables ni información que identifique "
        "a beneficiarios. Se rechazan patrones obvios de correo, teléfono y DNI. "
        "El administrador debe revisar antes de publicar."
    ),
)
def submit_profile(
    payload: CommunityKitchenProfileIn,
    kitchen_id: int = Path(ge=1),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    require_kitchen(kitchen_id)
    if not db.is_active_community_kitchen_member(kitchen_id, current_user.id):
        raise HTTPException(status_code=403, detail="Se requiere membresía aprobada")
    profile = db.submit_community_kitchen_profile(
        kitchen_id,
        current_user.id,
        payload.model_dump(),
    )
    if profile is None:
        raise HTTPException(
            status_code=409, detail="Ya existe una versión pendiente de revisión"
        )
    return profile


@router.get(
    "/admin/community-kitchen-claims",
    response_model=list[AdminCommunityKitchenClaimOut],
    summary="Listar solicitudes de administración de comedores",
)
def list_claims(
    claim_status: ClaimStatus = Query(default=ClaimStatus.pending, alias="status"),
    _admin: AuthenticatedUser = Depends(require_admin),
):
    return db.list_community_kitchen_claims(claim_status.value)


@router.patch(
    "/admin/community-kitchen-claims/{claim_id}/decision",
    response_model=CommunityKitchenClaimOut,
    summary="Aprobar o rechazar una solicitud de comedor",
)
def review_claim(
    claim_id: UUID,
    payload: ReviewIn,
    admin: AuthenticatedUser = Depends(require_admin),
):
    claim, changed = db.review_community_kitchen_claim(
        claim_id, payload.decision.value, admin.id
    )
    if claim is None:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if not changed:
        if claim["status"] == "pending" and claim.get("account_id") == admin.id:
            raise HTTPException(
                status_code=403, detail="No puedes revisar tu propia solicitud"
            )
        raise HTTPException(status_code=409, detail="La solicitud ya fue revisada")
    return claim


@router.get(
    "/admin/community-kitchen-profiles",
    response_model=list[AdminCommunityKitchenProfileOut],
    summary="Listar versiones de perfiles para moderación",
    description=(
        "Revisa cada campo antes de publicar y rechaza versiones con nombres/contactos "
        "de responsables o datos que identifiquen a beneficiarios."
    ),
)
def list_profiles(
    profile_status: ProfileStatus = Query(default=ProfileStatus.pending, alias="status"),
    _admin: AuthenticatedUser = Depends(require_admin),
):
    return db.list_community_kitchen_profiles(profile_status.value)


@router.patch(
    "/admin/community-kitchen-profiles/{profile_id}/decision",
    response_model=CommunityKitchenProfileOut,
    summary="Publicar o rechazar una versión del perfil",
)
def review_profile(
    profile_id: UUID,
    payload: ReviewIn,
    admin: AuthenticatedUser = Depends(require_admin),
):
    profile, changed = db.review_community_kitchen_profile(
        profile_id, payload.decision.value, admin.id
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="Versión de perfil no encontrada")
    if not changed:
        if (
            profile["status"] == "pending"
            and profile.get("submitted_by") == admin.id
        ):
            raise HTTPException(
                status_code=403, detail="No puedes revisar tu propia versión de perfil"
            )
        raise HTTPException(status_code=409, detail="La versión ya fue revisada")
    return profile
