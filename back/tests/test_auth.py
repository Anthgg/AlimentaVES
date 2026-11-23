import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from uuid import UUID, uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app import database as db
from app.auth import JWT_ALGORITHM
from app.config import jwt_secret
from app.main import app


@pytest.fixture
def client(monkeypatch):
    test_url = os.getenv("ALIMENTAVES_TEST_DATABASE_URL")
    parsed_url = urlparse(test_url or "")
    if (
        parsed_url.scheme not in {"postgres", "postgresql"}
        or parsed_url.path != "/alimentaves_test"
    ):
        raise RuntimeError(
            "Las pruebas de autenticación requieren "
            "ALIMENTAVES_TEST_DATABASE_URL apuntando a alimentaves_test"
        )

    monkeypatch.setenv("DATABASE_URL", test_url)
    monkeypatch.setenv("DEMO_SEED", "0")
    with TestClient(app) as test_client:
        yield test_client


def unique_email() -> str:
    return f"auth-{uuid4().hex}@example.com"


def register_user(client: TestClient, email: str | None = None) -> dict:
    response = client.post(
        "/api/auth/register",
        json={
            "email": email or unique_email(),
            "password": "Fictitious-Password-123!",
        },
    )
    assert response.status_code == 201
    return response.json()


def delete_users(user_ids: list[UUID]) -> None:
    if not user_ids:
        return
    with db.connect() as conn:
        conn.execute("DELETE FROM auth_users WHERE id = ANY(%s)", (user_ids,))


def insert_role_user(role: str, email: str, password_hash: str) -> UUID:
    user_id = uuid4()
    with db.connect() as conn:
        conn.execute(
            """
            INSERT INTO auth_users (id, email, password_hash, role)
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, email, password_hash, role),
        )
    return user_id


def test_register_persists_donor_and_argon2id_hash(client):
    account = register_user(client)
    user_id = UUID(account["id"])
    try:
        assert account["role"] == "donor"
        assert set(account) == {"id", "email", "role", "created_at"}

        with db.connect() as conn:
            stored = conn.execute(
                "SELECT password_hash, role FROM auth_users WHERE id = %s",
                (user_id,),
            ).fetchone()
        assert stored["password_hash"].startswith("$argon2id$")
        assert stored["password_hash"] != "Fictitious-Password-123!"
        assert stored["role"] == "donor"
    finally:
        delete_users([user_id])


@pytest.mark.parametrize("role", ["donor", "kitchen", "admin"])
def test_register_rejects_client_role_field(client, role):
    response = client.post(
        "/api/auth/register",
        json={
            "email": unique_email(),
            "password": "Fictitious-Password-123!",
            "role": role,
        },
    )
    assert response.status_code == 422


def test_register_requires_a_long_password(client):
    response = client.post(
        "/api/auth/register",
        json={"email": unique_email(), "password": "short"},
    )
    assert response.status_code == 422


def test_register_normalizes_email_and_rejects_duplicate(client):
    email = unique_email()
    account = register_user(client, email)
    user_id = UUID(account["id"])
    try:
        duplicate = client.post(
            "/api/auth/register",
            json={
                "email": email.upper(),
                "password": "Another-Fictitious-123!",
            },
        )
        assert duplicate.status_code == 409
        assert account["email"] == email.casefold()
    finally:
        delete_users([user_id])


def test_login_me_and_jwt_required_claims_with_configured_expiration(
    client, monkeypatch
):
    monkeypatch.setenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "7")
    account = register_user(client)
    user_id = UUID(account["id"])
    try:
        login = client.post(
            "/api/auth/login",
            json={
                "email": account["email"],
                "password": "Fictitious-Password-123!",
            },
        )
        assert login.status_code == 200
        body = login.json()
        assert body["token_type"] == "bearer"
        assert body["expires_in"] == 7 * 60

        claims = jwt.decode(
            body["access_token"],
            jwt_secret(),
            algorithms=[JWT_ALGORITHM],
        )
        assert {"sub", "jti", "iat", "exp"} <= set(claims)
        assert UUID(claims["sub"]) == user_id
        assert claims["exp"] - claims["iat"] == 7 * 60

        me = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {body['access_token']}"},
        )
        assert me.status_code == 200
        assert me.json()["id"] == str(user_id)
        assert me.json()["email"] == account["email"]
        assert me.json()["role"] == "donor"
        assert set(me.json()) == {"id", "email", "role", "created_at"}
    finally:
        delete_users([user_id])


def test_invalid_credentials_and_tokens_return_401(client):
    account = register_user(client)
    user_id = UUID(account["id"])
    try:
        failed_login = client.post(
            "/api/auth/login",
            json={
                "email": account["email"],
                "password": "Incorrect-Password-123!",
            },
        )
        assert failed_login.status_code == 401
        assert client.post(
            "/api/auth/login",
            json={"email": account["email"], "password": "x"},
        ).status_code == 401
        assert client.post(
            "/api/auth/login",
            json={"email": unique_email(), "password": "Incorrect-Password-123!"},
        ).status_code == 401

        assert client.get("/api/auth/me").status_code == 401
        assert client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer malformed-token"},
        ).status_code == 401
        assert client.post("/api/auth/logout").status_code == 401

        now = datetime.now(timezone.utc)
        expired = jwt.encode(
            {
                "sub": str(user_id),
                "jti": str(uuid4()),
                "iat": int((now - timedelta(hours=2)).timestamp()),
                "exp": int((now - timedelta(hours=1)).timestamp()),
            },
            jwt_secret(),
            algorithm=JWT_ALGORITHM,
        )
        assert client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {expired}"},
        ).status_code == 401
    finally:
        delete_users([user_id])


def test_logout_revokes_current_token(client):
    account = register_user(client)
    user_id = UUID(account["id"])
    try:
        login = client.post(
            "/api/auth/login",
            json={
                "email": account["email"],
                "password": "Fictitious-Password-123!",
            },
        )
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        claims = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
        token_jti = UUID(claims["jti"])

        assert client.get("/api/auth/me", headers=headers).status_code == 200
        logout = client.post("/api/auth/logout", headers=headers)
        assert logout.status_code == 204
        assert logout.content == b""
        assert client.get("/api/auth/me", headers=headers).status_code == 401

        with db.connect() as conn:
            revoked = conn.execute(
                "SELECT jti FROM auth_revoked_tokens WHERE jti = %s",
                (token_jti,),
            ).fetchone()
        assert revoked is not None
    finally:
        delete_users([user_id])


@pytest.mark.parametrize("role", ["kitchen", "admin"])
def test_persisted_non_donor_roles_are_returned_by_me(client, role):
    from app.auth import hash_password

    email = unique_email()
    user_id = insert_role_user(
        role,
        email,
        hash_password("Fictitious-Password-123!"),
    )
    try:
        login = client.post(
            "/api/auth/login",
            json={"email": email, "password": "Fictitious-Password-123!"},
        )
        assert login.status_code == 200
        me = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        )
        assert me.status_code == 200
        assert me.json()["role"] == role
    finally:
        delete_users([user_id])
