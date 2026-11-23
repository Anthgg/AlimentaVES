import os
from io import BytesIO
from urllib.parse import urlparse
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import database as db
from app import community_kitchen_media_db as media_db
from app.auth import hash_password
from app.main import app

TEST_PASSWORD = "Fictitious-Password-123!"


@pytest.fixture
def client(monkeypatch, tmp_path):
    test_url = os.getenv("ALIMENTAVES_TEST_DATABASE_URL")
    parsed_url = urlparse(test_url or "")
    if parsed_url.scheme not in {"postgres", "postgresql"} or parsed_url.path != "/alimentaves_test":
        raise RuntimeError("F08 requiere ALIMENTAVES_TEST_DATABASE_URL apuntando a alimentaves_test")
    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("DEMO_SEED", "0")
    monkeypatch.setenv("MEDIA_STORAGE_PATH", str(tmp_path))
    with TestClient(app) as test_client:
        media_db.init_media_db()
        yield test_client


def get_test_connection():
    conn = db.connect()
    if conn.info.dbname != "alimentaves_test":
        conn.close()
        raise RuntimeError("F08 solo puede modificar alimentaves_test")
    return conn


def setup_member(client: TestClient) -> tuple[int, str, UUID, str, UUID, UUID, str]:
    kitchen_id = None
    source_code = f"TEST-F08-{uuid4().hex}"
    member_id = uuid4()
    profile_id = uuid4()
    admin_id = uuid4()
    admin_email = f"f08-admin-{uuid4().hex}@example.com"
    member_email = f"f08-{uuid4().hex}@example.com"
    with get_test_connection() as conn:
        kitchen = conn.execute(
            """INSERT INTO community_kitchens
               (source_code, name, district, ubigeo, source_url, downloaded_at)
               VALUES (%s, %s, 'VILLA EL SALVADOR', '150142',
                       'https://example.invalid/f08-test', NOW()) RETURNING id""",
            (source_code, "F08 Comedor ficticio"),
        ).fetchone()
        kitchen_id = kitchen["id"]
        conn.execute(
            "INSERT INTO auth_users (id, email, password_hash, role) VALUES (%s, %s, %s, 'kitchen')",
            (member_id, member_email, hash_password(TEST_PASSWORD)),
        )
        conn.execute(
            "INSERT INTO community_kitchen_memberships (kitchen_id, account_id) VALUES (%s, %s)",
            (kitchen_id, member_id),
        )
        conn.execute(
            """INSERT INTO community_kitchen_profiles
               (id, kitchen_id, description, status, submitted_by)
               VALUES (%s, %s, 'Perfil ficticio F08', 'pending', %s)""",
            (profile_id, kitchen_id, member_id),
        )
        conn.execute(
            "INSERT INTO auth_users (id, email, password_hash, role) VALUES (%s, %s, %s, 'admin')",
            (admin_id, admin_email, hash_password(TEST_PASSWORD)),
        )
    return kitchen_id, source_code, member_id, member_email, profile_id, admin_id, admin_email


def login_headers(client: TestClient, email: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def cleanup(kitchen_id: int, source_code: str, account_ids: list[UUID], profile_ids: list[UUID], photo_ids: list[UUID]):
    if not source_code.startswith("TEST-F08-"):
        raise RuntimeError("Cleanup rechazado: código fuera del espacio TEST-F08")
    with get_test_connection() as conn:
        if photo_ids:
            conn.execute("DELETE FROM community_kitchen_photos WHERE id = ANY(%s)", (photo_ids,))
        if profile_ids:
            conn.execute("DELETE FROM community_kitchen_profiles WHERE id = ANY(%s)", (profile_ids,))
        conn.execute("DELETE FROM community_kitchen_memberships WHERE kitchen_id = %s", (kitchen_id,))
        conn.execute("DELETE FROM community_kitchen_claims WHERE kitchen_id = %s", (kitchen_id,))
        conn.execute("DELETE FROM community_kitchens WHERE id = %s AND source_code = %s", (kitchen_id, source_code))
        if account_ids:
            conn.execute("DELETE FROM auth_users WHERE id = ANY(%s)", (account_ids,))


def png_bytes() -> bytes:
    image = Image.new("RGB", (12, 9), (40, 120, 80))
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_photo_upload_validates_membership_and_requires_admin_publication(client):
    kitchen_id, source_code, member_id, member_email, profile_id, admin_id, admin_email = setup_member(client)
    photo_ids: list[UUID] = []
    profile_ids = [profile_id]
    try:
        member_headers = login_headers(client, member_email)
        upload = {
            "data": {"profile_id": str(profile_id), "category": "gallery"},
            "files": {"file": ("mi-foto.png", png_bytes(), "image/png")},
        }
        assert client.post(f"/api/community-kitchens/{kitchen_id}/photos", **upload).status_code == 401
        assert client.post(
            f"/api/community-kitchens/{kitchen_id}/photos",
            headers=member_headers,
            data={"profile_id": str(profile_id), "category": "gallery"},
            files={"file": ("mal.png", b"not an image", "image/png")},
        ).status_code == 415

        uploaded = client.post(
            f"/api/community-kitchens/{kitchen_id}/photos",
            headers=member_headers,
            **upload,
        )
        assert uploaded.status_code == 201, uploaded.text
        body = uploaded.json()
        photo_id = UUID(body["id"])
        photo_ids.append(photo_id)
        assert body["status"] == "pending"
        assert body["category"] == "gallery"
        assert body["url"] == f"/api/media/{photo_id}"
        assert body["size_bytes"] <= 8 * 1024 * 1024
        assert client.get(body["url"]).status_code == 404
        assert client.get(f"/api/community-kitchens/{kitchen_id}/photos").json() == []

        with get_test_connection() as conn:
            conn.execute("UPDATE community_kitchen_profiles SET status = 'published' WHERE id = %s", (profile_id,))
        admin_headers = login_headers(client, admin_email)
        reviewed = client.patch(
            f"/api/admin/community-kitchen-photos/{photo_id}/decision",
            headers=admin_headers,
            json={"decision": "approved"},
        )
        assert reviewed.status_code == 200, reviewed.text
        listed = client.get(f"/api/community-kitchens/{kitchen_id}/photos?category=gallery")
        assert listed.status_code == 200
        assert [item["id"] for item in listed.json()] == [str(photo_id)]
        response = client.get(body["url"])
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("image/png")
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.content.startswith(b"\x89PNG\r\n\x1a\n")
    finally:
        cleanup(kitchen_id, source_code, [member_id, admin_id], profile_ids, photo_ids)
