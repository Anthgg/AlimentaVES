import os
from datetime import datetime, timezone
from urllib.parse import urlparse
from uuid import uuid4

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
        yield test_client


def insert_kitchen(source_code: str, name: str, district: str) -> int:
    with db.connect() as conn:
        row = conn.execute(
            """
            INSERT INTO community_kitchens (
                source_code, name, district, ubigeo, source_url, downloaded_at
            ) VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                source_code,
                name,
                district,
                "150142" if district == "VILLA EL SALVADOR" else "150141",
                "https://example.invalid/test-source",
                datetime.now(timezone.utc),
            ),
        ).fetchone()
    return row["id"]


def delete_test_kitchens(source_codes: list[str]) -> None:
    with db.connect() as conn:
        conn.execute(
            "DELETE FROM community_kitchens WHERE source_code = ANY(%s)",
            (source_codes,),
        )


def test_list_filters_and_pagination_use_postgres(client):
    codes = [f"TEST-{uuid4().hex}" for _ in range(3)]
    ids = []
    try:
        ids.append(insert_kitchen(codes[0], "F01 Test Comedor A", "VILLA EL SALVADOR"))
        ids.append(insert_kitchen(codes[1], "F01 Test Comedor B", "VILLA EL SALVADOR"))
        ids.append(insert_kitchen(codes[2], "F01 Test Comedor C", "SAN JUAN DE MIRAFLORES"))

        response = client.get(
            "/api/community-kitchens",
            params={
                "name": "F01 Test",
                "district": "villa el salvador",
                "limit": 1,
                "offset": 1,
            },
        )

        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        assert rows[0]["id"] == ids[1]
        assert rows[0]["source_code"] == codes[1]
        assert rows[0]["ubigeo"] == "150142"
        assert rows[0]["source_status"] is None
        assert rows[0]["address"] is None
    finally:
        delete_test_kitchens(codes)


def test_get_kitchen_by_id_and_validate_pagination(client):
    code = f"TEST-{uuid4().hex}"
    kitchen_id = insert_kitchen(code, "F01 Detalle de prueba", "VILLA EL SALVADOR")
    try:
        response = client.get(f"/api/community-kitchens/{kitchen_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "F01 Detalle de prueba"

        assert client.get("/api/community-kitchens/999999999").status_code == 404
        assert client.get("/api/community-kitchens/no-es-uuid").status_code == 422
        assert client.get("/api/community-kitchens?limit=0").status_code == 422
        assert client.get("/api/community-kitchens?offset=-1").status_code == 422
    finally:
        delete_test_kitchens([code])
