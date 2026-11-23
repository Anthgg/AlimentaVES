"""PostgreSQL metadata and persistent byte storage for kitchen photos."""
from __future__ import annotations

import os
from pathlib import Path
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from .config import database_url


def connect() -> psycopg.Connection:
    return psycopg.connect(database_url(), row_factory=dict_row)


def media_root() -> Path:
    return Path(os.getenv("MEDIA_STORAGE_PATH", "/data/media")).resolve()


def init_media_db() -> None:
    """Create only the additive media table after the core schema exists."""
    with connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS community_kitchen_photos (
                id UUID PRIMARY KEY,
                kitchen_id BIGINT NOT NULL
                    REFERENCES community_kitchens(id) ON DELETE RESTRICT,
                profile_id UUID NOT NULL
                    REFERENCES community_kitchen_profiles(id) ON DELETE CASCADE,
                category VARCHAR(12) NOT NULL
                    CHECK (category IN ('profile', 'cover', 'gallery', 'food')),
                file_path TEXT NOT NULL UNIQUE,
                content_type VARCHAR(32) NOT NULL
                    CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
                size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
                width INTEGER NOT NULL CHECK (width > 0),
                height INTEGER NOT NULL CHECK (height > 0),
                status VARCHAR(12) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'published', 'rejected')),
                uploaded_by UUID NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
                uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                reviewed_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMPTZ
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS community_kitchen_photos_public_idx "
            "ON community_kitchen_photos(kitchen_id, category, uploaded_at DESC) "
            "WHERE status = 'published'"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS community_kitchen_photos_review_idx "
            "ON community_kitchen_photos(status, uploaded_at)"
        )


def profile_belongs_to_kitchen(profile_id: UUID, kitchen_id: int) -> bool:
    with connect() as conn:
        return conn.execute(
            "SELECT 1 FROM community_kitchen_profiles "
            "WHERE id = %s AND kitchen_id = %s",
            (profile_id, kitchen_id),
        ).fetchone() is not None


def create_photo(row: dict) -> dict:
    with connect() as conn:
        return dict(conn.execute(
            """INSERT INTO community_kitchen_photos
               (id, kitchen_id, profile_id, category, file_path, content_type,
                size_bytes, width, height, uploaded_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, kitchen_id, profile_id, category, content_type,
                         size_bytes, width, height, status, uploaded_at""",
            (row["id"], row["kitchen_id"], row["profile_id"], row["category"],
             row["file_path"], row["content_type"], row["size_bytes"],
             row["width"], row["height"], row["uploaded_by"]),
        ).fetchone())


def get_photo(photo_id: UUID, *, public_only: bool = False) -> dict | None:
    query = """SELECT p.id, p.kitchen_id, p.profile_id, p.category,
                      p.file_path, p.content_type, p.size_bytes, p.width,
                      p.height, p.status, p.uploaded_by, p.uploaded_at,
                      cp.status AS profile_status
               FROM community_kitchen_photos p
               JOIN community_kitchen_profiles cp ON cp.id = p.profile_id
               WHERE p.id = %s"""
    if public_only:
        query += " AND p.status = 'published' AND cp.status = 'published'"
    with connect() as conn:
        row = conn.execute(query, (photo_id,)).fetchone()
    return dict(row) if row else None


def list_public_photos(kitchen_id: int, category: str | None = None) -> list[dict]:
    query = """SELECT p.id, p.kitchen_id, p.profile_id, p.category,
                      p.content_type, p.size_bytes, p.width, p.height,
                      p.status, p.uploaded_at
               FROM community_kitchen_photos p
               JOIN community_kitchen_profiles cp ON cp.id = p.profile_id
               WHERE p.kitchen_id = %s AND p.status = 'published'
                 AND cp.status = 'published'"""
    params: list[object] = [kitchen_id]
    if category is not None:
        query += " AND p.category = %s"
        params.append(category)
    query += " ORDER BY p.uploaded_at DESC, p.id"
    with connect() as conn:
        return [dict(row) for row in conn.execute(query, params).fetchall()]


def list_pending_photos() -> list[dict]:
    with connect() as conn:
        rows = conn.execute("""SELECT p.id, p.kitchen_id, p.profile_id,
                    p.category, p.content_type, p.size_bytes, p.width,
                    p.height, p.status, p.uploaded_by, p.uploaded_at,
                    k.name AS kitchen_name
                FROM community_kitchen_photos p
                JOIN community_kitchens k ON k.id = p.kitchen_id
                WHERE p.status = 'pending'
                ORDER BY p.uploaded_at, p.id""").fetchall()
    return [dict(row) for row in rows]


def review_photo(photo_id: UUID, decision: str, admin_id: UUID) -> tuple[dict | None, bool]:
    new_status = "published" if decision == "approved" else "rejected"
    with connect() as conn:
        photo = conn.execute(
            "SELECT id, status, uploaded_by FROM community_kitchen_photos "
            "WHERE id = %s FOR UPDATE", (photo_id,),
        ).fetchone()
        if photo is None:
            return None, False
        if photo["status"] != "pending" or photo["uploaded_by"] == admin_id:
            return dict(photo), False
        row = conn.execute("""UPDATE community_kitchen_photos
            SET status = %s, reviewed_by = %s, reviewed_at = NOW()
            WHERE id = %s AND status = 'pending'
            RETURNING id, kitchen_id, profile_id, category, content_type,
                      size_bytes, width, height, status, uploaded_at""",
            (new_status, admin_id, photo_id),
        ).fetchone()
    return dict(row), row is not None
