"""Persistent internal notifications. No external delivery integrations."""

from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, ConfigDict, Field

from .auth import AuthenticatedUser, get_current_user
from .database import connect


def init_notifications_db() -> None:
    with connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
                notification_type VARCHAR(48) NOT NULL,
                title VARCHAR(160) NOT NULL,
                body VARCHAR(500) NOT NULL,
                related_type VARCHAR(48),
                related_id VARCHAR(80),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                read_at TIMESTAMPTZ
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS notifications_user_unread_idx "
            "ON notifications(user_id, created_at DESC) WHERE read_at IS NULL"
        )


def create_notification(
    user_id: UUID,
    notification_type: str,
    title: str,
    body: str,
    related_type: str | None = None,
    related_id: str | None = None,
) -> dict:
    """Insert an internal notification for a user and return its public fields."""
    with connect() as conn:
        row = conn.execute(
            """INSERT INTO notifications
               (id, user_id, notification_type, title, body, related_type, related_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               RETURNING id, user_id, notification_type, title, body,
                         related_type, related_id, created_at, read_at""",
            (uuid4(), user_id, notification_type, title, body, related_type, related_id),
        ).fetchone()
    return dict(row)


def notify_admins(
    notification_type: str,
    title: str,
    body: str,
    related_type: str | None = None,
    related_id: str | None = None,
) -> int:
    """Fan out a generic internal event to current admin accounts."""
    with connect() as conn:
        admin_ids = [row["id"] for row in conn.execute(
            "SELECT id FROM auth_users WHERE role = 'admin' AND is_active = TRUE"
        ).fetchall()]
    for user_id in admin_ids:
        create_notification(
            user_id, notification_type, title, body, related_type, related_id
        )
    return len(admin_ids)


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    notification_type: str
    title: str
    body: str
    related_type: str | None
    related_id: str | None
    created_at: datetime
    read_at: datetime | None


class NotificationPage(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int = Field(ge=0)


router = APIRouter(prefix="/notifications", tags=["Notificaciones"])


@router.get("", response_model=NotificationPage)
def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    with connect() as conn:
        count = conn.execute(
            "SELECT COUNT(*) AS count FROM notifications WHERE user_id = %s AND read_at IS NULL",
            (current_user.id,),
        ).fetchone()["count"]
        if unread_only:
            rows = conn.execute(
                """SELECT id, notification_type, title, body, related_type, related_id,
                          created_at, read_at FROM notifications
                   WHERE user_id = %s AND read_at IS NULL
                   ORDER BY created_at DESC, id LIMIT %s OFFSET %s""",
                (current_user.id, limit, offset),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT id, notification_type, title, body, related_type, related_id,
                          created_at, read_at FROM notifications
                   WHERE user_id = %s
                   ORDER BY created_at DESC, id LIMIT %s OFFSET %s""",
                (current_user.id, limit, offset),
            ).fetchall()
    return {"notifications": rows, "unread_count": count}


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: UUID = Path(),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    with connect() as conn:
        row = conn.execute(
            """UPDATE notifications SET read_at = COALESCE(read_at, NOW())
               WHERE id = %s AND user_id = %s
               RETURNING id, notification_type, title, body, related_type,
                         related_id, created_at, read_at""",
            (notification_id, current_user.id),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return row


@router.patch("/read-all", status_code=204)
def mark_all_notifications_read(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    with connect() as conn:
        conn.execute(
            "UPDATE notifications SET read_at = NOW() "
            "WHERE user_id = %s AND read_at IS NULL",
            (current_user.id,),
        )
