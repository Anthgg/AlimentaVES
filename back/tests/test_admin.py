import os
from urllib.parse import urlparse
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import database as db
from app.auth import create_access_token
from app.database import init_db
from app.routes.admin import router as admin_router

api_application = FastAPI()
api_application.include_router(admin_router, prefix="/api")


@pytest.fixture
def client(monkeypatch):
    test_url = os.getenv("ALIMENTAVES_TEST_DATABASE_URL")
    if urlparse(test_url or "").path != "/alimentaves_test":
        raise RuntimeError("Estas pruebas requieren alimentaves_test")
    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("DEMO_SEED", "0")
    init_db()
    with TestClient(api_application) as test_client:
        yield test_client


def add_user(role: str) -> tuple[UUID, dict[str, str]]:
    user_id = uuid4()
    email = f"admin-test-{user_id.hex}@example.test"
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


def test_admin_read_endpoints_hide_password_hash_and_require_admin(client):
    admin_id, admin_headers = add_user("admin")
    donor_id, donor_headers = add_user("donor")
    try:
        forbidden = client.get("/api/admin/users", headers=donor_headers)
        assert forbidden.status_code == 403

        response = client.get("/api/admin/users?limit=10", headers=admin_headers)
        assert response.status_code == 200
        body = response.json()
        assert any(row["id"] == str(donor_id) for row in body)
        assert all("password_hash" not in row for row in body)
        assert all("token" not in key for row in body for key in row)

        assert client.get("/api/admin/community-kitchens", headers=admin_headers).status_code == 200
        assert client.get("/api/admin/donations", headers=admin_headers).status_code == 200
        assert client.get("/api/admin/users").status_code == 401
    finally:
        delete_users(admin_id, donor_id)
