import os
from urllib.parse import urlparse
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import database as db
from app.auth import create_access_token
from app.database import init_db
from app.notifications import (
    create_notification,
    init_notifications_db,
    notify_admins,
    router as notifications_router,
)

api_application = FastAPI()
api_application.include_router(notifications_router, prefix="/api")


@pytest.fixture
def client(monkeypatch):
    test_url = os.getenv("ALIMENTAVES_TEST_DATABASE_URL")
    if urlparse(test_url or "").path != "/alimentaves_test":
        raise RuntimeError("Estas pruebas requieren alimentaves_test")
    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("DEMO_SEED", "0")
    init_db()
    init_notifications_db()
    with TestClient(api_application) as test_client:
        yield test_client


def add_user(role: str) -> tuple[UUID, dict[str, str]]:
    user_id = uuid4()
    email = f"notification-test-{user_id.hex}@example.test"
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO auth_users (id, email, password_hash, role) VALUES (%s,%s,%s,%s)",
            (user_id, email, "test-only-not-a-real-password-hash", role),
        )
    token, _jti, _expiry, _seconds = create_access_token(user_id)
    return user_id, {"Authorization": f"Bearer {token}"}


def delete_users(*user_ids: UUID) -> None:
    with db.connect() as conn:
        conn.execute("DELETE FROM auth_users WHERE id = ANY(%s)", (list(user_ids),))


def test_notifications_are_private_and_mark_read(client):
    owner_id, owner_headers = add_user("donor")
    other_id, other_headers = add_user("donor")
    try:
        item = create_notification(
            owner_id,
            "donation_request_approved",
            "Solicitud aprobada",
            "Una solicitud fue aprobada.",
            "donation_request",
            "req-1",
        )
        notification_id = item["id"]

        listed = client.get("/api/notifications", headers=owner_headers)
        assert listed.status_code == 200
        assert listed.json()["unread_count"] == 1
        assert listed.json()["notifications"][0]["id"] == str(notification_id)

        hidden = client.patch(
            f"/api/notifications/{notification_id}/read", headers=other_headers
        )
        assert hidden.status_code == 404

        marked = client.patch(
            f"/api/notifications/{notification_id}/read", headers=owner_headers
        )
        assert marked.status_code == 200
        assert marked.json()["read_at"] is not None
        assert client.get(
            "/api/notifications?unread_only=true", headers=owner_headers
        ).json()["notifications"] == []

        assert client.get("/api/notifications").status_code == 401
    finally:
        delete_users(owner_id, other_id)


def test_admin_notification_fanout_and_read_all(client):
    admin_id, admin_headers = add_user("admin")
    try:
        assert notify_admins(
            "donation_request_created",
            "Nueva solicitud",
            "Hay una solicitud pendiente para revisar.",
            "donation_request",
            "req-3",
        ) >= 1
        response = client.get("/api/notifications", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["unread_count"] == 1
        assert response.json()["notifications"][0]["notification_type"] == "donation_request_created"
        read_all = client.patch("/api/notifications/read-all", headers=admin_headers)
        assert read_all.status_code == 204
        remaining = client.get("/api/notifications", headers=admin_headers)
        assert remaining.json()["unread_count"] == 0
        assert remaining.json()["notifications"][0]["read_at"] is not None
    finally:
        delete_users(admin_id)
