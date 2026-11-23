import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from urllib.parse import urlparse
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app import database as db
from app.main import app


@pytest.fixture
def client(monkeypatch):
    url = os.getenv("ALIMENTAVES_TEST_DATABASE_URL")
    if not url or urlparse(url).path != "/alimentaves_test":
        raise RuntimeError(
            "Las pruebas requieren ALIMENTAVES_TEST_DATABASE_URL "
            "con la base aislada alimentaves_test"
        )

    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("DEMO_SEED", "0")
    with TestClient(app) as test_client:
        with db.connect() as conn:
            # Request history references donations; truncate both tables in
            # this test-only database.
            conn.execute("TRUNCATE TABLE donation_requests, donations")
        try:
            yield test_client
        finally:
            with db.connect() as conn:
                conn.execute("TRUNCATE TABLE donation_requests, donations")


def valid_payload():
    return {
        "donor_name": "Donante ficticio",
        "food_name": "Arroz sellado",
        "quantity_kg": 7.0,
        "pickup_address": "Punto de prueba, Villa El Salvador",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "notes": "Solo demostración",
    }


def test_complete_flow(client):
    assert client.get("/api/health").json() == {"status": "ok"}

    response = client.post("/api/donations", json=valid_payload())
    assert response.status_code == 201
    identifier = response.json()["id"]
    assert response.json()["status"] == "available"
    assert len(client.get("/api/donations?status=available").json()) == 1

    reservation = client.patch(
        f"/api/donations/{identifier}/reserve",
        json={"reserved_by": "Comedor ficticio"},
    )
    assert reservation.status_code == 200
    assert reservation.json()["status"] == "reserved"

    assert client.patch(
        f"/api/donations/{identifier}/reserve",
        json={"reserved_by": "Otro comedor"},
    ).status_code == 409

    delivered = client.patch(f"/api/donations/{identifier}/deliver")
    assert delivered.status_code == 200
    assert delivered.json()["status"] == "delivered"
    assert client.patch(f"/api/donations/{identifier}/deliver").status_code == 409

    stats = client.get("/api/stats").json()
    assert stats["delivered"] == 1
    assert stats["kilograms_delivered"] == 7.0
    assert stats["estimated_servings"] == 20

    with db.connect() as conn:
        result = conn.execute(
            "SELECT food_name FROM donations WHERE id = %s",
            (UUID(identifier),),
        ).fetchone()
    assert result["food_name"] == "Arroz sellado"


def test_validation_and_not_found(client):
    payload = valid_payload()
    payload["quantity_kg"] = 0
    assert client.post("/api/donations", json=payload).status_code == 422
    missing_id = str(uuid4())
    assert client.get(f"/api/donations/{missing_id}").status_code == 404
    assert client.patch(f"/api/donations/{missing_id}/deliver").status_code == 404
    assert client.get("/api/donations/no-existe").status_code == 422


def test_create_validates_required_fields_and_future_timezone(client):
    payload = valid_payload()
    del payload["food_name"]
    assert client.post("/api/donations", json=payload).status_code == 422

    payload = valid_payload()
    payload["donor_name"] = "   "
    assert client.post("/api/donations", json=payload).status_code == 422

    payload = valid_payload()
    payload["quantity_kg"] = "Infinity"
    assert client.post("/api/donations", json=payload).status_code == 422

    payload = valid_payload()
    payload["expires_at"] = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert client.post("/api/donations", json=payload).status_code == 422

    payload = valid_payload()
    payload["expires_at"] = datetime.now().replace(microsecond=0).isoformat()
    assert client.post("/api/donations", json=payload).status_code == 422


def test_list_filters_detail_and_uuid_validation(client):
    created = client.post("/api/donations", json=valid_payload())
    assert created.status_code == 201
    identifier = created.json()["id"]

    assert client.get(f"/api/donations/{identifier}").json()["id"] == identifier
    assert len(client.get("/api/donations?status=available").json()) == 1
    assert client.get("/api/donations?status=reserved").json() == []
    assert client.get("/api/donations?status=unknown").status_code == 422
    assert client.get("/api/donations/not-a-uuid").status_code == 422
    assert client.get(f"/api/donations/{uuid4()}").status_code == 404


def test_reserve_and_delivery_validation_and_expiration(client):
    created = client.post("/api/donations", json=valid_payload())
    identifier = created.json()["id"]

    assert client.patch(f"/api/donations/{identifier}/reserve").status_code == 422
    assert client.patch(
        f"/api/donations/{identifier}/reserve", json={"reserved_by": "   "}
    ).status_code == 422
    assert client.patch(f"/api/donations/{identifier}/deliver").status_code == 409

    expired_id = uuid4()
    with db.connect() as conn:
        conn.execute(
            """INSERT INTO donations
               (id, donor_name, food_name, quantity_kg, pickup_address, expires_at)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (
                expired_id,
                "Donante ficticio",
                "Arroz sellado",
                3.0,
                "Punto de prueba, Villa El Salvador",
                datetime.now(timezone.utc) - timedelta(days=1),
            ),
        )

    response = client.patch(
        f"/api/donations/{expired_id}/reserve",
        json={"reserved_by": "Comedor ficticio"},
    )
    assert response.status_code == 409
    assert client.get(f"/api/donations/{expired_id}").json()["status"] == "available"


def test_simultaneous_reservations_are_atomic(client):
    created = client.post("/api/donations", json=valid_payload())
    identifier = created.json()["id"]
    barrier = Barrier(2)

    def reserve(reserved_by: str):
        barrier.wait(timeout=5)
        return db.transition(identifier, "available", "reserved", reserved_by)

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(reserve, ["Comedor ficticio A", "Comedor ficticio B"]))

    assert sum(result is not None for result in results) == 1
    assert client.get(f"/api/donations/{identifier}").json()["status"] == "reserved"
