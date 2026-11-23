"""Consultas PostgreSQL de AlimentaVES."""
import atexit
from datetime import datetime
from decimal import Decimal
from threading import Lock
from typing import Any
from uuid import UUID, uuid4

import psycopg
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

from .config import (
    database_pool_max_size,
    database_pool_min_size,
    database_pool_timeout_seconds,
    database_sslmode,
    database_url,
)


_POOL: ConnectionPool | None = None
_POOL_LOCK = Lock()


class _PooledConnection:
    """Return a checked-out connection to its pool when its context closes."""

    def __init__(self, pool: ConnectionPool, connection: psycopg.Connection):
        self._pool = pool
        self._connection = connection
        self._released = False

    def __getattr__(self, name: str) -> Any:
        return getattr(self._connection, name)

    def __enter__(self) -> psycopg.Connection:
        if self._released:
            raise RuntimeError("La conexión ya fue devuelta al pool")
        try:
            self._connection.__enter__()
        except Exception:
            self._release()
            raise
        return self._connection

    def __exit__(self, exc_type, exc_value, traceback) -> bool | None:
        if self._released:
            return None
        try:
            return self._connection.__exit__(exc_type, exc_value, traceback)
        finally:
            self._release()

    def close(self) -> None:
        """Release the connection, preserving the direct-connect API contract."""
        self._release()

    def _release(self) -> None:
        if not self._released:
            self._released = True
            self._pool.putconn(self._connection)


def connect() -> _PooledConnection:
    """Borrow a bounded connection while preserving psycopg's close/context API."""
    global _POOL
    with _POOL_LOCK:
        if _POOL is None:
            _POOL = ConnectionPool(
                conninfo=database_url(),
                kwargs={"row_factory": dict_row, "sslmode": database_sslmode()},
                min_size=database_pool_min_size(),
                max_size=database_pool_max_size(),
                timeout=database_pool_timeout_seconds(),
                name="alimentaves-postgres",
                open=True,
            )
        pool = _POOL
    return _PooledConnection(
        pool,
        pool.getconn(timeout=database_pool_timeout_seconds()),
    )


def close_pool() -> None:
    """Close the per-instance pool during FastAPI shutdown."""
    global _POOL
    with _POOL_LOCK:
        pool, _POOL = _POOL, None
    if pool is not None:
        pool.close()


atexit.register(close_pool)


def init_db() -> None:
    with connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS auth_users (
                id UUID PRIMARY KEY,
                email VARCHAR(254) NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role VARCHAR(16) NOT NULL DEFAULT 'donor'
                    CHECK (role IN ('donor', 'kitchen', 'admin')),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS auth_revoked_tokens (
                jti UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
                expires_at TIMESTAMPTZ NOT NULL,
                revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS auth_revoked_tokens_expires_idx "
            "ON auth_revoked_tokens(expires_at)"
        )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS donations (
                id UUID PRIMARY KEY,
                donor_name VARCHAR(100) NOT NULL,
                food_name VARCHAR(120) NOT NULL,
                quantity_kg NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
                pickup_address VARCHAR(200) NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                notes VARCHAR(500),
                status VARCHAR(12) NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'reserved', 'delivered')),
                reserved_by VARCHAR(120),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                delivered_at TIMESTAMPTZ
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS donations_status_idx ON donations(status)"
        )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS community_kitchens (
                id BIGSERIAL PRIMARY KEY,
                source_object_id BIGINT,
                source_code VARCHAR(100) NOT NULL UNIQUE,
                name VARCHAR(254) NOT NULL,
                district VARCHAR(120) NOT NULL,
                ubigeo CHAR(6) NOT NULL,
                address TEXT,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                modality VARCHAR(120),
                source_status VARCHAR(120),
                users_count INTEGER CHECK (users_count IS NULL OR users_count >= 0),
                source_url TEXT NOT NULL,
                downloaded_at TIMESTAMPTZ NOT NULL,
                verified_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
                CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS community_kitchens_district_idx "
            "ON community_kitchens(district)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS community_kitchens_name_idx "
            "ON community_kitchens(name)"
        )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS community_kitchen_claims (
                id UUID PRIMARY KEY,
                kitchen_id BIGINT NOT NULL
                    REFERENCES community_kitchens(id) ON DELETE RESTRICT,
                account_id UUID NOT NULL
                    REFERENCES auth_users(id) ON DELETE CASCADE,
                status VARCHAR(12) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
                submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                reviewed_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMPTZ
            )
        """)
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS community_kitchen_claims_pending_account_idx "
            "ON community_kitchen_claims(account_id) WHERE status = 'pending'"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS community_kitchen_claims_status_idx "
            "ON community_kitchen_claims(status, submitted_at)"
        )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS community_kitchen_memberships (
                kitchen_id BIGINT NOT NULL
                    REFERENCES community_kitchens(id) ON DELETE RESTRICT,
                account_id UUID NOT NULL
                    REFERENCES auth_users(id) ON DELETE CASCADE,
                role VARCHAR(16) NOT NULL DEFAULT 'kitchen'
                    CHECK (role = 'kitchen'),
                status VARCHAR(12) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'revoked')),
                approved_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (kitchen_id, account_id)
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS community_kitchen_memberships_account_idx "
            "ON community_kitchen_memberships(account_id, status)"
        )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS community_kitchen_profiles (
                id UUID PRIMARY KEY,
                kitchen_id BIGINT NOT NULL
                    REFERENCES community_kitchens(id) ON DELETE RESTRICT,
                description VARCHAR(2000),
                operating_hours VARCHAR(500),
                institutional_location VARCHAR(500),
                needs VARCHAR(2000),
                status VARCHAR(12) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'published', 'rejected')),
                submitted_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
                submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                reviewed_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMPTZ
            )
        """)
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS community_kitchen_profiles_pending_idx "
            "ON community_kitchen_profiles(kitchen_id) WHERE status = 'pending'"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS community_kitchen_profiles_published_submitted_idx "
            "ON community_kitchen_profiles(kitchen_id, submitted_at DESC) "
            "WHERE status = 'published'"
        )


def _id(value: str) -> UUID | None:
    try:
        return UUID(value)
    except (ValueError, TypeError, AttributeError):
        return None


def _format(row: dict | None) -> dict | None:
    if row is None:
        return None
    data = dict(row)
    data["id"] = str(data["id"])
    if isinstance(data["quantity_kg"], Decimal):
        data["quantity_kg"] = float(data["quantity_kg"])
    return data


def create_donation(data: dict) -> dict:
    expiry = data["expires_at"]
    if isinstance(expiry, str):
        expiry = datetime.fromisoformat(expiry)
    with connect() as conn:
        row = conn.execute("""
            INSERT INTO donations
                (id, donor_name, food_name, quantity_kg,
                 pickup_address, expires_at, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            uuid4(), data["donor_name"], data["food_name"],
            data["quantity_kg"], data["pickup_address"],
            expiry, data.get("notes"),
        )).fetchone()
    return _format(row)


def get_donation(donation_id: str) -> dict | None:
    ident = _id(donation_id)
    if ident is None:
        return None
    with connect() as conn:
        return _format(conn.execute(
            "SELECT * FROM donations WHERE id = %s", (ident,)
        ).fetchone())


def list_donations(status: str | None = None) -> list[dict]:
    with connect() as conn:
        if status is None:
            rows = conn.execute(
                "SELECT * FROM donations ORDER BY created_at DESC, id"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM donations WHERE status = %s "
                "ORDER BY created_at DESC, id", (status,)
            ).fetchall()
    return [_format(row) for row in rows]


def transition(
    donation_id: str, from_status: str, to_status: str,
    reserved_by: str | None = None,
) -> dict | None:
    ident = _id(donation_id)
    if ident is None:
        return None
    with connect() as conn:
        row = conn.execute("""
            UPDATE donations
            SET status = %s,
                reserved_by = COALESCE(%s, reserved_by),
                delivered_at = CASE WHEN %s = 'delivered'
                    THEN NOW() ELSE delivered_at END
            WHERE id = %s AND status = %s
                AND (%s <> 'reserved' OR expires_at > NOW())
            RETURNING *
        """, (
            to_status, reserved_by, to_status, ident, from_status, to_status,
        )).fetchone()
    return _format(row)


def get_stats() -> dict:
    with connect() as conn:
        row = conn.execute("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'available') AS available,
                COUNT(*) FILTER (WHERE status = 'reserved') AS reserved,
                COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
                COALESCE(SUM(quantity_kg)
                    FILTER (WHERE status = 'delivered'), 0)
                    AS kilograms_delivered
            FROM donations
        """).fetchone()
    kg = round(float(row["kilograms_delivered"]), 2)
    return {
        "available": row["available"],
        "reserved": row["reserved"],
        "delivered": row["delivered"],
        "kilograms_delivered": kg,
        "estimated_servings": int((kg + 1e-9) / 0.35),
    }


def create_donor_user(email: str, password_hash: str) -> dict | None:
    """Create a donor account; the public caller cannot choose its role."""
    with connect() as conn:
        row = conn.execute("""
            INSERT INTO auth_users (id, email, password_hash, role)
            VALUES (%s, %s, %s, 'donor')
            ON CONFLICT (email) DO NOTHING
            RETURNING id, email, role, is_active, created_at
        """, (uuid4(), email, password_hash)).fetchone()
    return dict(row) if row is not None else None


def get_auth_user_by_email(email: str) -> dict | None:
    """Return a user and hash for credential verification."""
    with connect() as conn:
        row = conn.execute("""
            SELECT id, email, password_hash, role, is_active, created_at
            FROM auth_users
            WHERE email = %s
        """, (email,)).fetchone()
    return dict(row) if row is not None else None


def get_active_auth_user(user_id: UUID, token_jti: UUID) -> dict | None:
    """Resolve an active user only when the presented token is not revoked."""
    with connect() as conn:
        row = conn.execute("""
            SELECT u.id, u.email, u.role, u.is_active, u.created_at
            FROM auth_users AS u
            WHERE u.id = %s
                AND u.is_active
                AND NOT EXISTS (
                    SELECT 1 FROM auth_revoked_tokens AS revoked
                    WHERE revoked.jti = %s
                )
        """, (user_id, token_jti)).fetchone()
    return dict(row) if row is not None else None


def revoke_auth_token(user_id: UUID, token_jti: UUID, expires_at: datetime) -> None:
    """Persist a token revocation until its original expiration time."""
    with connect() as conn:
        conn.execute("""
            INSERT INTO auth_revoked_tokens (jti, user_id, expires_at)
            VALUES (%s, %s, %s)
            ON CONFLICT (jti) DO NOTHING
        """, (token_jti, user_id, expires_at))


def get_community_kitchen_stats() -> dict:
    """Return source-backed metrics for community kitchens in PostgreSQL."""
    with connect() as conn:
        totals = conn.execute("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (
                    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                ) AS located,
                COUNT(DISTINCT NULLIF(LOWER(BTRIM(district)), ''))
                    AS district_count,
                COUNT(users_count) AS records_with_reported_users,
                COALESCE(SUM(users_count), 0) AS source_reported_users_total
            FROM community_kitchens
        """).fetchone()
        statuses = conn.execute("""
            SELECT
                COALESCE(NULLIF(BTRIM(source_status), ''), 'unknown') AS status,
                COUNT(*) AS count
            FROM community_kitchens
            GROUP BY 1
            ORDER BY 1
        """).fetchall()

    return {
        "total": totals["total"],
        "located": totals["located"],
        "district_count": totals["district_count"],
        "status_breakdown": {
            row["status"]: row["count"] for row in statuses
        },
        "records_with_reported_users": totals["records_with_reported_users"],
        "source_reported_users_total": totals["source_reported_users_total"],
    }


def donation_count() -> int:
    with connect() as conn:
        return conn.execute(
            "SELECT COUNT(*) AS total FROM donations"
        ).fetchone()["total"]


def list_community_kitchens(
    name: str | None = None,
    district: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    conditions = []
    params: list[object] = []
    if name:
        conditions.append("name ILIKE %s")
        params.append(f"%{name}%")
    if district:
        conditions.append("LOWER(district) = LOWER(%s)")
        params.append(district)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.extend((limit, offset))
    with connect() as conn:
        rows = conn.execute(
            f"SELECT * FROM community_kitchens {where} "
            "ORDER BY name, source_code LIMIT %s OFFSET %s",
            params,
        ).fetchall()
    return [dict(row) for row in rows]


def get_community_kitchen(kitchen_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM community_kitchens WHERE id = %s", (kitchen_id,)
        ).fetchone()
    return dict(row) if row is not None else None


def is_active_community_kitchen_member(kitchen_id: int, account_id: UUID) -> bool:
    with connect() as conn:
        row = conn.execute(
            """SELECT 1 FROM community_kitchen_memberships
               WHERE kitchen_id = %s AND account_id = %s
                 AND role = 'kitchen' AND status = 'active'""",
            (kitchen_id, account_id),
        ).fetchone()
    return row is not None


def create_community_kitchen_claim(kitchen_id: int, account_id: UUID) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            """INSERT INTO community_kitchen_claims
                   (id, kitchen_id, account_id)
               VALUES (%s, %s, %s)
               ON CONFLICT (account_id) WHERE status = 'pending' DO NOTHING
               RETURNING id, kitchen_id, status, submitted_at, reviewed_at""",
            (uuid4(), kitchen_id, account_id),
        ).fetchone()
    return dict(row) if row is not None else None


def list_community_kitchen_claims(status: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """SELECT claim.id, claim.kitchen_id, claim.account_id,
                      account.email AS account_email, kitchen.name AS kitchen_name,
                      claim.status, claim.submitted_at,
                      claim.reviewed_by, claim.reviewed_at
               FROM community_kitchen_claims AS claim
               JOIN community_kitchens AS kitchen ON kitchen.id = claim.kitchen_id
               JOIN auth_users AS account ON account.id = claim.account_id
               WHERE claim.status = %s
               ORDER BY claim.submitted_at, claim.id""",
            (status,),
        ).fetchall()
    return [dict(row) for row in rows]


def review_community_kitchen_claim(
    claim_id: UUID, decision: str, reviewed_by: UUID
) -> tuple[dict | None, bool]:
    with connect() as conn:
        claim = conn.execute(
            """SELECT id, kitchen_id, account_id, status, submitted_at,
                      reviewed_by, reviewed_at
               FROM community_kitchen_claims WHERE id = %s FOR UPDATE""",
            (claim_id,),
        ).fetchone()
        if claim is None:
            return None, False
        if claim["status"] != "pending":
            return dict(claim), False
        if claim["account_id"] == reviewed_by:
            return dict(claim), False

        updated = conn.execute(
            """UPDATE community_kitchen_claims
               SET status = %s, reviewed_by = %s, reviewed_at = NOW()
               WHERE id = %s AND status = 'pending'
               RETURNING id, kitchen_id, status, submitted_at,
                         reviewed_by, reviewed_at""",
            (decision, reviewed_by, claim_id),
        ).fetchone()
        if decision == "approved":
            conn.execute(
                """INSERT INTO community_kitchen_memberships
                       (kitchen_id, account_id, role, status, approved_by)
                   VALUES (%s, %s, 'kitchen', 'active', %s)
                   ON CONFLICT (kitchen_id, account_id) DO UPDATE SET
                       role = 'kitchen', status = 'active', approved_by = EXCLUDED.approved_by,
                       updated_at = NOW()""",
                (claim["kitchen_id"], claim["account_id"], reviewed_by),
            )
            conn.execute(
                "UPDATE auth_users SET role = 'kitchen' "
                "WHERE id = %s AND role = 'donor'",
                (claim["account_id"],),
            )
    return dict(updated), True


def submit_community_kitchen_profile(
    kitchen_id: int, submitted_by: UUID, fields: dict
) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            """INSERT INTO community_kitchen_profiles
                   (id, kitchen_id, description, operating_hours,
                    institutional_location, needs, submitted_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (kitchen_id) WHERE status = 'pending' DO NOTHING
               RETURNING id, kitchen_id, description, operating_hours,
                         institutional_location, needs, status, submitted_at,
                         reviewed_at""",
            (
                uuid4(), kitchen_id, fields["description"],
                fields["operating_hours"], fields["institutional_location"],
                fields["needs"], submitted_by,
            ),
        ).fetchone()
    return dict(row) if row is not None else None


def get_published_community_kitchen_profile(kitchen_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute(
            """SELECT id, kitchen_id, description, operating_hours,
                      institutional_location, needs, status, submitted_at,
                      reviewed_at
               FROM community_kitchen_profiles
               WHERE kitchen_id = %s AND status = 'published'
               ORDER BY submitted_at DESC, reviewed_at DESC, id DESC
               LIMIT 1""",
            (kitchen_id,),
        ).fetchone()
    return dict(row) if row is not None else None


def list_community_kitchen_profiles(status: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """SELECT profile.id, profile.kitchen_id, kitchen.name AS kitchen_name,
                      profile.description, profile.operating_hours,
                      profile.institutional_location, profile.needs, profile.status,
                      profile.submitted_by, account.email AS submitter_email,
                      profile.submitted_at, profile.reviewed_by, profile.reviewed_at
               FROM community_kitchen_profiles AS profile
               JOIN community_kitchens AS kitchen ON kitchen.id = profile.kitchen_id
               LEFT JOIN auth_users AS account ON account.id = profile.submitted_by
               WHERE profile.status = %s
               ORDER BY profile.submitted_at, profile.id""",
            (status,),
        ).fetchall()
    return [dict(row) for row in rows]


def review_community_kitchen_profile(
    profile_id: UUID, decision: str, reviewed_by: UUID
) -> tuple[dict | None, bool]:
    profile_status = "published" if decision == "approved" else "rejected"
    with connect() as conn:
        profile = conn.execute(
            """SELECT id, kitchen_id, description, operating_hours,
                      institutional_location, needs, status, submitted_at,
                      submitted_by, reviewed_by, reviewed_at
               FROM community_kitchen_profiles WHERE id = %s FOR UPDATE""",
            (profile_id,),
        ).fetchone()
        if profile is None:
            return None, False
        if profile["status"] != "pending":
            return dict(profile), False
        if profile["submitted_by"] == reviewed_by:
            return dict(profile), False
        row = conn.execute(
            """UPDATE community_kitchen_profiles
               SET status = %s, reviewed_by = %s, reviewed_at = NOW()
               WHERE id = %s AND status = 'pending'
               RETURNING id, kitchen_id, description, operating_hours,
                         institutional_location, needs, status, submitted_at,
                         reviewed_at""",
            (profile_status, reviewed_by, profile_id),
        ).fetchone()
    return dict(row), True
