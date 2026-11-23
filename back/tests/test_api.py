from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("ALIMENTAVES_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("DEMO_SEED", "0")
    with TestClient(app) as test_client:
        yield test_client

def valid_payload():
    return {
        "donor_name": "Donante de prueba",
        "food_name": "Arroz sellado",
        "quantity_kg": 7.0,
        "pickup_address": "Punto ficticio, Villa El Salvador",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "notes": "Solo pruebas",
    }

def test_complete_donation_flow(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    created_response = client.post("/api/donations", json=valid_payload())
    assert created_response.status_code == 201
    donation = created_response.json()
    identifier = donation["id"]
    assert donation["status"] == "available"
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

def test_validation_and_not_found(client):
    payload = valid_payload()
    payload["quantity_kg"] = 0
    assert client.post("/api/donations", json=payload).status_code == 422
    assert client.get("/api/donations/no-existe").status_code == 404
    assert client.patch("/api/donations/no-existe/deliver").status_code == 404
