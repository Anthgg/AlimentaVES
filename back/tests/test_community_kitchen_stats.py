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


def insert_kitchens(rows: list[tuple]) -> None:
    with db.connect() as conn:
        with conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO community_kitchens (
                    source_code, name, district, ubigeo, source_status,
                    latitude, longitude, users_count, source_url, downloaded_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )


def delete_kitchens(source_codes: list[str]) -> None:
    with db.connect() as conn:
        conn.execute(
            "DELETE FROM community_kitchens WHERE source_code = ANY(%s)",
            (source_codes,),
        )


def test_stats_aggregate_postgres_kitchens_without_changing_donation_stats(client):
    before_response = client.get("/api/community-kitchens/stats")
    assert before_response.status_code == 200
    before = before_response.json()
    assert set(before) == {
        "total",
        "located",
        "district_count",
        "status_breakdown",
        "records_with_reported_users",
        "source_reported_users_total",
    }

    token = uuid4().hex
    codes = [f"TEST-F03-{token}-{index}" for index in range(3)]
    district = f"F03 TEST {token}"
    now = datetime.now(timezone.utc)
    rows = [
        (
            codes[0], "F03 Kitchen One", district.upper(), "150142", None,
            -76.9, -12.2, 4, "https://example.invalid/test-source", now,
        ),
        (
            codes[1], "F03 Kitchen Two", district.lower(), "150142", " ",
            -76.8, None, 6, "https://example.invalid/test-source", now,
        ),
        (
            codes[2], "F03 Kitchen Three", f"F03 OTHER {token}", "150141",
            "ACTIVO", -76.7, -12.1, None,
            "https://example.invalid/test-source", now,
        ),
    ]

    try:
        insert_kitchens(rows)
        response = client.get("/api/community-kitchens/stats")
        assert response.status_code == 200
        after = response.json()

        assert after["total"] == before["total"] + 3
        assert after["located"] == before["located"] + 2
        assert after["district_count"] == before["district_count"] + 2
        assert after["status_breakdown"]["unknown"] == (
            before["status_breakdown"].get("unknown", 0) + 2
        )
        assert after["status_breakdown"]["ACTIVO"] == (
            before["status_breakdown"].get("ACTIVO", 0) + 1
        )
        assert after["records_with_reported_users"] == (
            before["records_with_reported_users"] + 2
        )
        assert after["source_reported_users_total"] == (
            before["source_reported_users_total"] + 10
        )

        # The existing donations stats contract is left intact.
        donation_stats = client.get("/api/stats")
        assert donation_stats.status_code == 200
        assert set(donation_stats.json()) == {
            "available",
            "reserved",
            "delivered",
            "kilograms_delivered",
            "estimated_servings",
        }
    finally:
        delete_kitchens(codes)
