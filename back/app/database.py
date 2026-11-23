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


def donation_count() -> int:
    with connect() as conn:
        return conn.execute(
            "SELECT COUNT(*) AS total FROM donations"
        ).fetchone()["total"]
