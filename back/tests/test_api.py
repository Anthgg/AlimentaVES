import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from uuid import UUID

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
            conn.execute("TRUNCATE TABLE donations")
        try:
            yield test_client
        finally:
            with db.connect() as conn:
                conn.execute("TRUNCATE TABLE donations")


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
    assert client.get("/api/donations/no-existe").status_code == 404
    assert client.patch("/api/donations/no-existe/deliver").status_code == 404
