"""Kitchen image upload, moderation, and public delivery endpoints."""
from __future__ import annotations

import warnings
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path as ApiPath, Query, UploadFile, status
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError

from .. import database as db
from .. import community_kitchen_media_db as media_db
from ..auth import AuthenticatedUser, get_current_user
from ..community_kitchen_media_schemas import (
    PhotoCategory,
    PhotoDecision,
    PhotoOut,
    PhotoReviewIn,
)
from .community_kitchen_profiles import require_admin

router = APIRouter(tags=["Fotografías de comedores"])
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}


def _public_view(row: dict) -> dict:
    return {
        "id": row["id"],
        "kitchen_id": row["kitchen_id"],
        "profile_id": row["profile_id"],
        "category": row["category"],
        "content_type": row["content_type"],
        "size_bytes": row["size_bytes"],
        "width": row["width"],
        "height": row["height"],
        "status": row["status"],
        "url": f"/api/media/{row['id']}",
        "uploaded_at": row["uploaded_at"].isoformat(),
    }


def _sanitize_image(payload: bytes, declared_type: str) -> tuple[bytes, str, str, int, int]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(payload)) as image:
                image_format = image.format
                if image_format not in _FORMATS:
                    raise HTTPException(415, "Formato admitido: JPEG, PNG o WebP")
                content_type, extension = _FORMATS[image_format]
                if declared_type.lower() != content_type:
                    raise HTTPException(415, "El tipo declarado no coincide con la imagen")
                width, height = image.size
                if width < 1 or height < 1 or width * height > MAX_IMAGE_PIXELS:
                    raise HTTPException(413, "La imagen supera el límite de dimensiones")
                image.verify()
            with Image.open(BytesIO(payload)) as image:
                image = ImageOps.exif_transpose(image)
                image.load()
                has_alpha = "A" in image.getbands()
                clean = image.convert("RGBA" if has_alpha else "RGB")
                output = BytesIO()
                if image_format == "JPEG":
                    clean.save(output, format="JPEG", quality=90, optimize=True)
                elif image_format == "PNG":
                    clean.save(output, format="PNG", optimize=True)
                else:
                    clean.save(output, format="WEBP", quality=90, method=4)
                sanitized = output.getvalue()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as exc:
        raise HTTPException(415, "El archivo no es una imagen válida") from exc
    if len(sanitized) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "La imagen excede 8 MiB después de normalizarla")
    return sanitized, content_type, extension, width, height


async def _read_upload(file: UploadFile) -> bytes:
    if file.content_type not in {item[0] for item in _FORMATS.values()}:
        raise HTTPException(415, "Formato admitido: JPEG, PNG o WebP")
    payload = await file.read(MAX_IMAGE_BYTES + 1)
    if not payload:
        raise HTTPException(422, "El archivo está vacío")
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "El archivo supera el límite de 8 MiB")
    return payload


@router.post(
    "/community-kitchens/{kitchen_id}/photos",
    response_model=PhotoOut,
    status_code=status.HTTP_201_CREATED,
    summary="Subir fotografía para revisión",
)
async def upload_photo(
    kitchen_id: int = ApiPath(ge=1),
    profile_id: UUID = Form(...),
    category: PhotoCategory = Form(...),
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if db.get_community_kitchen(kitchen_id) is None:
        raise HTTPException(404, "Comedor no encontrado")
    if not db.is_active_community_kitchen_member(kitchen_id, current_user.id):
        raise HTTPException(403, "Se requiere membresía aprobada")
    if not media_db.profile_belongs_to_kitchen(profile_id, kitchen_id):
        raise HTTPException(404, "Perfil de comedor no encontrado")

    original = await _read_upload(file)
    payload, content_type, extension, width, height = _sanitize_image(
        original, file.content_type or ""
    )
    photo_id = uuid4()
    relative_path = f"{photo_id.hex}{extension}"
    root = media_db.media_root()
    root.mkdir(parents=True, exist_ok=True)
    target = root / relative_path
    temporary = root / f".{photo_id.hex}.tmp"
    try:
        temporary.write_bytes(payload)
        temporary.replace(target)
        row = media_db.create_photo({
            "id": photo_id,
            "kitchen_id": kitchen_id,
            "profile_id": profile_id,
            "category": category.value,
            "file_path": relative_path,
            "content_type": content_type,
            "size_bytes": len(payload),
            "width": width,
            "height": height,
            "uploaded_by": current_user.id,
        })
    except Exception:
        target.unlink(missing_ok=True)
        temporary.unlink(missing_ok=True)
        raise
    return _public_view(row)


@router.get(
    "/community-kitchens/{kitchen_id}/photos",
    response_model=list[PhotoOut],
    summary="Listar fotografías publicadas de un comedor",
)
def list_photos(
    kitchen_id: int = ApiPath(ge=1),
    category: PhotoCategory | None = Query(default=None),
):
    if db.get_community_kitchen(kitchen_id) is None:
        raise HTTPException(404, "Comedor no encontrado")
    return [_public_view(row) for row in media_db.list_public_photos(
        kitchen_id, category.value if category else None
    )]


def _serve_photo(photo_id: UUID, *, public_only: bool) -> Response:
    row = media_db.get_photo(photo_id, public_only=public_only)
    if row is None:
        raise HTTPException(404, "Fotografía no encontrada")
    root = media_db.media_root()
    path = (root / row["file_path"]).resolve()
    if path.parent != root or not path.is_file():
        raise HTTPException(404, "Fotografía no encontrada")
    return Response(
        path.read_bytes(),
        media_type=row["content_type"],
        headers={"Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/media/{photo_id}", summary="Ver fotografía publicada")
def get_public_photo(photo_id: UUID):
    return _serve_photo(photo_id, public_only=True)


@router.get(
    "/admin/community-kitchen-photos",
    summary="Listar fotografías pendientes de moderación",
)
def list_pending_photos(_admin: AuthenticatedUser = Depends(require_admin)):
    return [
        {**row, "preview_url": f"/api/admin/community-kitchen-photos/{row['id']}/content"}
        for row in media_db.list_pending_photos()
    ]


@router.get(
    "/admin/community-kitchen-photos/{photo_id}/content",
    summary="Ver fotografía pendiente para moderación",
)
def get_photo_for_moderation(
    photo_id: UUID,
    _admin: AuthenticatedUser = Depends(require_admin),
):
    row = media_db.get_photo(photo_id)
    if row is None:
        raise HTTPException(404, "Fotografía no encontrada")
    path = (media_db.media_root() / row["file_path"]).resolve()
    if path.parent != media_db.media_root() or not path.is_file():
        raise HTTPException(404, "Fotografía no encontrada")
    return Response(
        path.read_bytes(),
        media_type=row["content_type"],
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.patch(
    "/admin/community-kitchen-photos/{photo_id}/decision",
    summary="Aprobar o rechazar fotografía",
)
def review_photo(
    photo_id: UUID,
    payload: PhotoReviewIn,
    admin: AuthenticatedUser = Depends(require_admin),
):
    row, changed = media_db.review_photo(photo_id, payload.decision.value, admin.id)
    if row is None:
        raise HTTPException(404, "Fotografía no encontrada")
    if not changed:
        if row.get("uploaded_by") == admin.id:
            raise HTTPException(403, "No puedes revisar tu propia fotografía")
        raise HTTPException(409, "La fotografía ya fue revisada")
    return {**row, "url": f"/api/media/{row['id']}"}

# Startup integration: call after the core database schema exists.
init_media_db = media_db.init_media_db

