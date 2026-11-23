"""F09 integration tests; every write is guarded to alimentaves_test."""

import os
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from uuid import UUID, uuid4
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import database as db
from app.auth import hash_password
from app.donation_requests import init_requests_db
from app.routes.auth import router as auth_router
from app.routes.donation_requests import router


PASSWORD = "Fictitious-Password-123!"


def open_test_connection():
    conn = db.connect()
    if conn.info.dbname != "alimentaves_test":
        conn.close()
        raise RuntimeError("F09 solo puede modificar alimentaves_test")
    return conn


@pytest.fixture
def client(monkeypatch):
    test_url = os.getenv("ALIMENTAVES_TEST_DATABASE_URL")
    parsed = urlparse(test_url or "")
    if parsed.scheme not in {"postgres", "postgresql"} or parsed.path != "/alimentaves_test":
        raise RuntimeError(
            "F09 requiere ALIMENTAVES_TEST_DATABASE_URL apuntando a alimentaves_test"
        )
    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("DEMO_SEED", "0")

    @asynccontextmanager
    async def lifespan(_app):
        db.init_db()
        init_requests_db()
        yield

    test_app = FastAPI(lifespan=lifespan)
    test_app.include_router(auth_router, prefix="/api")
    test_app.include_router(router, prefix="/api")
    with TestClient(test_app) as test_client:
        yield test_client


def insert_kitchen() -> tuple[int, str]:
    source_code = f"TEST-F09-{uuid4().hex}"
    with open_test_connection() as conn:
        row = conn.execute(
            """INSERT INTO community_kitchens
                   (source_code, name, district, ubigeo, source_url, downloaded_at)
               VALUES (%s, 'F09 Kitchen', 'VILLA EL SALVADOR', '150142',
                       'test://f09', NOW()) RETURNING id""",
            (source_code,),
        ).fetchone()
    return row["id"], source_code


def insert_user(role: str) -> tuple[UUID, str]:
    user_id = uuid4()
    email = f"f09-{uuid4().hex}@example.com"
    with open_test_connection() as conn:
        conn.execute(
            """INSERT INTO auth_users (id, email, password_hash, role)
               VALUES (%s, %s, %s, %s)""",
            (user_id, email, hash_password(PASSWORD), role),
        )
    return user_id, email


def token_for(client: TestClient, email: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def insert_donation() -> UUID:
    donation_id = uuid4()
    with open_test_connection() as conn:
        conn.execute(
            """INSERT INTO donations
                   (id, donor_name, food_name, quantity_kg, pickup_address, expires_at)
               VALUES (%s, 'F09 test', 'Arroz', 3, 'Dirección de prueba', NOW() + INTERVAL '7 days')""",
            (donation_id,),
        )
    return donation_id


def cleanup(
    donation_ids: list[UUID], kitchen_ids: list[tuple[int, str]], user_ids: list[UUID]
) -> None:
    with open_test_connection() as conn:
        if donation_ids:
            conn.execute("DELETE FROM donation_requests WHERE donation_id = ANY(%s)", (donation_ids,))
            conn.execute("DELETE FROM donations WHERE id = ANY(%s)", (donation_ids,))
        for kitchen_id, source_code in kitchen_ids:
            if not source_code.startswith("TEST-F09-"):
                raise RuntimeError("Cleanup rechazado: código fuera de TEST-F09")
            conn.execute("DELETE FROM community_kitchen_memberships WHERE kitchen_id = %s", (kitchen_id,))
            conn.execute(
                "DELETE FROM community_kitchens WHERE id = %s AND source_code = %s",
                (kitchen_id, source_code),
            )
        if user_ids:
            conn.execute("DELETE FROM auth_users WHERE id = ANY(%s)", (user_ids,))


def test_requests_are_scoped_and_concurrent_approval_reserves_once(client):
    donation_id = insert_donation()
    kitchen_a = insert_kitchen()
    kitchen_b = insert_kitchen()
    user_a, email_a = insert_user("kitchen")
    user_b, email_b = insert_user("kitchen")
    outsider_id, outsider_email = insert_user("donor")
    admin_id, admin_email = insert_user("admin")
    users = [user_a, user_b, outsider_id, admin_id]
    try:
        headers_a, headers_b = token_for(client, email_a), token_for(client, email_b)
        outsider_headers = token_for(client, outsider_email)
        admin_headers = token_for(client, admin_email)
        with open_test_connection() as conn:
            for kitchen_id, user_id in ((kitchen_a[0], user_a), (kitchen_b[0], user_b)):
                conn.execute(
                    """INSERT INTO community_kitchen_memberships
                           (kitchen_id, account_id, status) VALUES (%s, %s, 'active')""",
                    (kitchen_id, user_id),
                )

        assert client.post(
            f"/api/donations/{donation_id}/requests",
            json={"kitchen_id": kitchen_a[0]},
        ).status_code == 401
        assert client.post(
            f"/api/donations/{donation_id}/requests",
            headers=outsider_headers,
            json={"kitchen_id": kitchen_a[0]},
        ).status_code == 403
        first = client.post(
            f"/api/donations/{donation_id}/requests",
            headers=headers_a,
            json={"kitchen_id": kitchen_a[0]},
        )
        second = client.post(
            f"/api/donations/{donation_id}/requests",
            headers=headers_b,
            json={"kitchen_id": kitchen_b[0]},
        )
        assert first.status_code == second.status_code == 201
        first_id, second_id = first.json()["id"], second.json()["id"]
        assert client.post(
            f"/api/donations/{donation_id}/requests",
            headers=headers_a,
            json={"kitchen_id": kitchen_a[0]},
        ).status_code == 409
        assert len(client.get("/api/donation-requests", headers=headers_a).json()) == 1
        assert client.get(
            f"/api/donation-requests/{second_id}", headers=headers_a
        ).status_code == 404
        assert client.patch(
            f"/api/admin/donation-requests/{first_id}/decision",
            headers=headers_a,
            json={"decision": "approved"},
        ).status_code == 403

        def approve(request_id: str):
            return client.patch(
                f"/api/admin/donation-requests/{request_id}/decision",
                headers=admin_headers,
                json={"decision": "approved"},
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(approve, [first_id, second_id]))
        assert sorted(response.status_code for response in results) == [200, 409]
        with open_test_connection() as conn:
            donation = conn.execute(
                "SELECT status FROM donations WHERE id = %s", (donation_id,)
            ).fetchone()
            states = conn.execute(
                "SELECT status, COUNT(*) AS total FROM donation_requests "
                "WHERE donation_id = %s GROUP BY status",
                (donation_id,),
            ).fetchall()
        assert donation["status"] == "reserved"
        assert {row["status"]: row["total"] for row in states} == {
            "approved": 1,
            "rejected": 1,
        }
    finally:
        cleanup([donation_id], [kitchen_a, kitchen_b], users)
