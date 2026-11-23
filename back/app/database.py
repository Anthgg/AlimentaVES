"""Consultas PostgreSQL de AlimentaVES."""
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

import psycopg
from psycopg.rows import dict_row

from .config import database_url


def connect() -> psycopg.Connection:
    return psycopg.connect(database_url(), row_factory=dict_row)


def init_db() -> None:
    with connect() as conn:
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
