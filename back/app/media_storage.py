"""Persistent object storage for approved and pending kitchen photos."""
from __future__ import annotations

from . import community_kitchen_media_db as media_db
from .config import gcs_bucket_name, media_storage_backend


def _safe_name(name: str) -> str:
    if not name or name in {".", ".."} or "/" in name or "\\" in name:
        raise ValueError("Invalid media object name")
    return name


def _gcs_bucket():
    bucket_name = gcs_bucket_name()
    if not bucket_name:
        raise RuntimeError("GCS_BUCKET_NAME must be configured for GCS media storage")
    from google.cloud import storage

    return storage.Client().bucket(bucket_name)


def save(name: str, payload: bytes, content_type: str) -> None:
    name = _safe_name(name)
    if media_storage_backend() == "gcs":
        _gcs_bucket().blob(name).upload_from_string(
            payload,
            content_type=content_type,
            if_generation_match=0,
        )
        return

    root = media_db.media_root()
    root.mkdir(parents=True, exist_ok=True)
    target = (root / name).resolve()
    if target.parent != root:
        raise ValueError("Invalid local media path")
    temporary = root / f".{name}.tmp"
    try:
        temporary.write_bytes(payload)
        temporary.replace(target)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def read(name: str) -> bytes | None:
    name = _safe_name(name)
    if media_storage_backend() == "gcs":
        from google.api_core.exceptions import NotFound

        try:
            return _gcs_bucket().blob(name).download_as_bytes()
        except NotFound:
            return None

    root = media_db.media_root()
    target = (root / name).resolve()
    if target.parent != root or not target.is_file():
        return None
    return target.read_bytes()


def delete(name: str) -> None:
    name = _safe_name(name)
    if media_storage_backend() == "gcs":
        from google.api_core.exceptions import NotFound

        try:
            _gcs_bucket().blob(name).delete()
        except NotFound:
            pass
        return

    root = media_db.media_root()
    target = (root / name).resolve()
    if target.parent == root:
        target.unlink(missing_ok=True)
