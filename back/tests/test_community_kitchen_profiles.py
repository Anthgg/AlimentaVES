import os
from urllib.parse import urlparse
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app import database as db
from app.auth import hash_password
from app.main import app


TEST_PASSWORD = "Fictitious-Password-123!"


@pytest.fixture
def client(monkeypatch):
    test_url = os.getenv("ALIMENTAVES_TEST_DATABASE_URL")
    parsed_url = urlparse(test_url or "")
    if (
        parsed_url.scheme not in {"postgres", "postgresql"}
        or parsed_url.path != "/alimentaves_test"
    ):
        raise RuntimeError(
            "F07 requiere ALIMENTAVES_TEST_DATABASE_URL apuntando a alimentaves_test"
        )

    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("DEMO_SEED", "0")
    with TestClient(app) as test_client:
        yield test_client


def get_test_connection():
    conn = db.connect()
    if conn.info.dbname != "alimentaves_test":
        conn.close()
        raise RuntimeError("F07 solo puede modificar alimentaves_test")
    return conn


def insert_test_kitchen() -> tuple[int, str]:
    code = f"TEST-F07-{uuid4().hex}"
    with get_test_connection() as conn:
        row = conn.execute(
            """INSERT INTO community_kitchens (
                   source_code, name, district, ubigeo, source_url, downloaded_at
               ) VALUES (%s, %s, %s, %s, %s, NOW()) RETURNING id""",
            (
                code,
                "F07 Comedor ficticio",
                "VILLA EL SALVADOR",
                "150142",
                "https://example.invalid/f07-test-source",
            ),
        ).fetchone()
    return row["id"], code


def register_account(client: TestClient) -> tuple[UUID, dict[str, str]]:
    email = f"f07-{uuid4().hex}@example.com"
    registered = client.post(
        "/api/auth/register", json={"email": email, "password": TEST_PASSWORD}
    )
    assert registered.status_code == 201
    account_id = UUID(registered.json()["id"])
    login = client.post(
        "/api/auth/login", json={"email": email, "password": TEST_PASSWORD}
    )
    assert login.status_code == 200
    return account_id, {"Authorization": f"Bearer {login.json()['access_token']}"}


def register_admin(client: TestClient) -> tuple[UUID, dict[str, str]]:
    account_id = uuid4()
    email = f"f07-admin-{uuid4().hex}@example.com"
    with get_test_connection() as conn:
        conn.execute(
            """INSERT INTO auth_users (id, email, password_hash, role)
               VALUES (%s, %s, %s, 'admin')""",
            (account_id, email, hash_password(TEST_PASSWORD)),
        )
    login = client.post(
        "/api/auth/login", json={"email": email, "password": TEST_PASSWORD}
    )
    assert login.status_code == 200
    return account_id, {"Authorization": f"Bearer {login.json()['access_token']}"}


def cleanup_test_records(kitchen_id: int, source_code: str, account_ids: list[UUID]):
    if not source_code.startswith("TEST-F07-"):
        raise RuntimeError("Cleanup rechazado: código fuera del espacio TEST-F07")
    with get_test_connection() as conn:
        conn.execute(
            "DELETE FROM community_kitchen_profiles WHERE kitchen_id = %s",
            (kitchen_id,),
        )
        conn.execute(
            "DELETE FROM community_kitchen_memberships WHERE kitchen_id = %s",
            (kitchen_id,),
        )
        conn.execute(
            "DELETE FROM community_kitchen_claims WHERE kitchen_id = %s",
            (kitchen_id,),
        )
        conn.execute(
            "DELETE FROM community_kitchens "
            "WHERE id = %s AND source_code = %s",
            (kitchen_id, source_code),
        )
        if account_ids:
            conn.execute(
                "DELETE FROM auth_users WHERE id = ANY(%s)", (account_ids,)
            )


def test_claim_is_bound_to_authenticated_account_and_only_admin_reviews(client):
    kitchen_id, source_code = insert_test_kitchen()
    member_id, member_headers = register_account(client)
    account_ids = [member_id]
    secondary_kitchen = None
    claim_id = None
    try:
        secondary_kitchen = insert_test_kitchen()
        other_id, other_headers = register_account(client)
        account_ids.append(other_id)

        assert client.post(
            f"/api/community-kitchens/{kitchen_id}/claims", json={}
        ).status_code == 401

        forged = client.post(
            f"/api/community-kitchens/{kitchen_id}/claims",
            headers=member_headers,
            json={"account_id": str(uuid4())},
        )
        assert forged.status_code == 422

        claim = client.post(
            f"/api/community-kitchens/{kitchen_id}/claims",
            headers=member_headers,
            json={},
        )
        assert claim.status_code == 201
        assert claim.json()["status"] == "pending"
        claim_id = UUID(claim.json()["id"])
        assert client.post(
            f"/api/community-kitchens/{secondary_kitchen[0]}/claims",
            headers=member_headers,
            json={},
        ).status_code == 409

        other_claim = client.post(
            f"/api/community-kitchens/{kitchen_id}/claims",
            headers=other_headers,
            json={},
        )
        assert other_claim.status_code == 201
        assert other_claim.json()["status"] == "pending"

        assert client.get(
            "/api/admin/community-kitchen-claims", headers=member_headers
        ).status_code == 403
        assert client.patch(
            f"/api/admin/community-kitchen-claims/{claim_id}/decision",
            headers=member_headers,
            json={"decision": "approved"},
        ).status_code == 403
        assert client.post(
            f"/api/community-kitchens/{secondary_kitchen[0]}/claims",
            headers=member_headers,
            json={},
        ).status_code == 409

        admin_id, admin_headers = register_admin(client)
        account_ids.append(admin_id)
        pending = client.get("/api/admin/community-kitchen-claims", headers=admin_headers)
        assert pending.status_code == 200
        matching = [row for row in pending.json() if row["id"] == str(claim_id)]
        assert len(matching) == 1
        assert matching[0]["account_id"] == str(member_id)
        assert matching[0]["account_email"].endswith("@example.com")

        approved = client.patch(
            f"/api/admin/community-kitchen-claims/{claim_id}/decision",
            headers=admin_headers,
            json={"decision": "approved"},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"
        assert client.patch(
            f"/api/admin/community-kitchen-claims/{claim_id}/decision",
            headers=admin_headers,
            json={"decision": "approved"},
        ).status_code == 409
        reopened_claim = client.post(
            f"/api/community-kitchens/{secondary_kitchen[0]}/claims",
            headers=member_headers,
            json={},
        )
        assert reopened_claim.status_code == 201
        assert client.get("/api/auth/me", headers=member_headers).json()["role"] == "kitchen"

        rejected = client.patch(
            f"/api/admin/community-kitchen-claims/{other_claim.json()['id']}/decision",
            headers=admin_headers,
            json={"decision": "rejected"},
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"
        assert client.patch(
            f"/api/admin/community-kitchen-claims/{other_claim.json()['id']}/decision",
            headers=admin_headers,
            json={"decision": "rejected"},
        ).status_code == 409
        assert client.get("/api/auth/me", headers=other_headers).json()["role"] == "donor"

        second_rejected = client.patch(
            f"/api/admin/community-kitchen-claims/{reopened_claim.json()['id']}/decision",
            headers=admin_headers,
            json={"decision": "rejected"},
        )
        assert second_rejected.status_code == 200

        admin_claim = client.post(
            f"/api/community-kitchens/{secondary_kitchen[0]}/claims",
            headers=admin_headers,
            json={},
        )
        assert admin_claim.status_code == 201
        self_review = client.patch(
            f"/api/admin/community-kitchen-claims/{admin_claim.json()['id']}/decision",
            headers=admin_headers,
            json={"decision": "approved"},
        )
        assert self_review.status_code == 403

        second_admin_id, second_admin_headers = register_admin(client)
        account_ids.append(second_admin_id)
        admin_approved = client.patch(
            f"/api/admin/community-kitchen-claims/{admin_claim.json()['id']}/decision",
            headers=second_admin_headers,
            json={"decision": "approved"},
        )
        assert admin_approved.status_code == 200
        assert client.get("/api/auth/me", headers=admin_headers).json()["role"] == "admin"
        admin_profile = {
            "description": "Perfil ficticio enviado por una cuenta administradora.",
            "operating_hours": None,
            "institutional_location": None,
            "needs": None,
        }
        admin_submission = client.put(
            f"/api/community-kitchens/{secondary_kitchen[0]}/profile",
            headers=admin_headers,
            json=admin_profile,
        )
        assert admin_submission.status_code == 202
        assert client.patch(
            f"/api/admin/community-kitchen-profiles/{admin_submission.json()['id']}/decision",
            headers=admin_headers,
            json={"decision": "approved"},
        ).status_code == 403
        admin_profile_approved = client.patch(
            f"/api/admin/community-kitchen-profiles/{admin_submission.json()['id']}/decision",
            headers=second_admin_headers,
            json={"decision": "approved"},
        )
        assert admin_profile_approved.status_code == 200

        with get_test_connection() as conn:
            membership = conn.execute(
                """SELECT role, status, approved_by FROM community_kitchen_memberships
                   WHERE kitchen_id = %s AND account_id = %s""",
                (kitchen_id, member_id),
            ).fetchone()
        assert membership == {
            "role": "kitchen",
            "status": "active",
            "approved_by": admin_id,
        }
    finally:
        cleanup_test_records(kitchen_id, source_code, account_ids)
        if secondary_kitchen is not None:
            cleanup_test_records(secondary_kitchen[0], secondary_kitchen[1], [])


def test_profile_versions_stay_hidden_until_admin_approval(client):
    kitchen_id, source_code = insert_test_kitchen()
    member_id, member_headers = register_account(client)
    outsider_id, outsider_headers = register_account(client)
    account_ids = [member_id, outsider_id]
    try:
        claim = client.post(
            f"/api/community-kitchens/{kitchen_id}/claims",
            headers=member_headers,
            json={},
        )
        assert claim.status_code == 201
        claim_id = claim.json()["id"]

        assert client.get(
            f"/api/community-kitchens/{kitchen_id}/profile"
        ).status_code == 404

        initial = {
            "description": "Comedor de prueba para el hackatón.",
            "operating_hours": "Lunes a viernes, 9:00 a 12:00.",
            "institutional_location": "Local comunitario ficticio.",
            "needs": "Arroz y menestras.",
        }
        assert client.put(
            f"/api/community-kitchens/{kitchen_id}/profile", json=initial
        ).status_code == 401
        assert client.put(
            f"/api/community-kitchens/{kitchen_id}/profile",
            headers=outsider_headers,
            json=initial,
        ).status_code == 403

        admin_id, admin_headers = register_admin(client)
        account_ids.append(admin_id)
        approved_claim = client.patch(
            f"/api/admin/community-kitchen-claims/{claim_id}/decision",
            headers=admin_headers,
            json={"decision": "approved"},
        )
        assert approved_claim.status_code == 200

        openapi = client.get("/openapi.json").json()
        schemas = openapi["components"]["schemas"]
        assert "identidad del solicitante" in schemas["ClaimRequestIn"]["description"]
        assert "beneficiarios" in schemas["CommunityKitchenProfileIn"]["properties"][
            "description"
        ]["description"]

        identifier_cases = [
            ("description", "Contacto: persona@example.org"),
            ("operating_hours", "Teléfono: +51 987 654 321"),
            ("institutional_location", "Línea: 01 234 5678"),
            ("needs", "DNI: 12345678"),
        ]
        for field, value in identifier_cases:
            invalid_profile = {**initial, field: value}
            invalid = client.put(
                f"/api/community-kitchens/{kitchen_id}/profile",
                headers=member_headers,
                json=invalid_profile,
            )
            assert invalid.status_code == 422, field

        forged_profile = {**initial, "submitted_by": str(outsider_id)}
        assert client.put(
            f"/api/community-kitchens/{kitchen_id}/profile",
            headers=member_headers,
            json=forged_profile,
        ).status_code == 422

        submission = client.put(
            f"/api/community-kitchens/{kitchen_id}/profile",
            headers=member_headers,
            json=initial,
        )
        assert submission.status_code == 202
        assert submission.json()["status"] == "pending"
        profile_id = submission.json()["id"]
        assert client.get(
            f"/api/community-kitchens/{kitchen_id}/profile"
        ).status_code == 404

        assert client.patch(
            f"/api/admin/community-kitchen-profiles/{profile_id}/decision",
            headers=member_headers,
            json={"decision": "approved"},
        ).status_code == 403

        published = client.patch(
            f"/api/admin/community-kitchen-profiles/{profile_id}/decision",
            headers=admin_headers,
            json={"decision": "approved"},
        )
        assert published.status_code == 200
        assert published.json()["status"] == "published"
        assert client.patch(
            f"/api/admin/community-kitchen-profiles/{profile_id}/decision",
            headers=admin_headers,
            json={"decision": "approved"},
        ).status_code == 409
        public_profile = client.get(f"/api/community-kitchens/{kitchen_id}/profile")
        assert public_profile.status_code == 200
        assert public_profile.json()["description"] == initial["description"]

        changed = {**initial, "needs": "Lentejas y aceite vegetal."}
        revision = client.put(
            f"/api/community-kitchens/{kitchen_id}/profile",
            headers=member_headers,
            json=changed,
        )
        assert revision.status_code == 202
        assert revision.json()["status"] == "pending"
        assert client.get(
            f"/api/community-kitchens/{kitchen_id}/profile"
        ).json()["needs"] == initial["needs"]
        assert client.put(
            f"/api/community-kitchens/{kitchen_id}/profile",
            headers=member_headers,
            json=changed,
        ).status_code == 409

        rejected = client.patch(
            f"/api/admin/community-kitchen-profiles/{revision.json()['id']}/decision",
            headers=admin_headers,
            json={"decision": "rejected"},
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"
        assert client.patch(
            f"/api/admin/community-kitchen-profiles/{revision.json()['id']}/decision",
            headers=admin_headers,
            json={"decision": "rejected"},
        ).status_code == 409
        assert client.get(
            f"/api/community-kitchens/{kitchen_id}/profile"
        ).json()["needs"] == initial["needs"]

        replacement = client.put(
            f"/api/community-kitchens/{kitchen_id}/profile",
            headers=member_headers,
            json=changed,
        )
        assert replacement.status_code == 202
        published_replacement = client.patch(
            f"/api/admin/community-kitchen-profiles/{replacement.json()['id']}/decision",
            headers=admin_headers,
            json={"decision": "approved"},
        )
        assert published_replacement.status_code == 200
        assert client.get(
            f"/api/community-kitchens/{kitchen_id}/profile"
        ).json()["needs"] == changed["needs"]

        with get_test_connection() as conn:
            source_row = conn.execute(
                """SELECT name, district, ubigeo, address
                   FROM community_kitchens WHERE id = %s""",
                (kitchen_id,),
            ).fetchone()
        assert source_row == {
            "name": "F07 Comedor ficticio",
            "district": "VILLA EL SALVADOR",
            "ubigeo": "150142",
            "address": None,
        }
    finally:
        cleanup_test_records(kitchen_id, source_code, account_ids)
