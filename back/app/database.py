"""Small transactional SQLite store for the time-boxed hackathon demo."""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from .config import db_path

SCHEMA = """
CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY,
    donor_name TEXT NOT NULL,
    food_name TEXT NOT NULL,
    quantity_kg REAL NOT NULL CHECK(quantity_kg > 0),
    pickup_address TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'available'
        CHECK(status IN ('available', 'reserved', 'delivered')),
    reserved_by TEXT,
    created_at TEXT NOT NULL,
    delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
"""

def connect() -> sqlite3.Connection:
    path = db_path()
    if path != ":memory:":
        Path(path).expanduser().parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection

def init_db() -> None:
    with connect() as connection:
        connection.executescript(SCHEMA)

def create_donation(data: dict) -> dict:
    donation_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with connect() as connection:
        connection.execute(
            """INSERT INTO donations
            (id, donor_name, food_name, quantity_kg, pickup_address, expires_at,
             notes, status, reserved_by, created_at, delivered_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'available', NULL, ?, NULL)""",
            (
                donation_id, data["donor_name"], data["food_name"],
                data["quantity_kg"], data["pickup_address"], data["expires_at"],
                data.get("notes"), now,
            ),
        )
    return get_donation(donation_id)

def get_donation(donation_id: str) -> dict | None:
    with connect() as connection:
        row = connection.execute(
            "SELECT * FROM donations WHERE id = ?", (donation_id,)
        ).fetchone()
    return dict(row) if row else None

def list_donations(status: str | None = None) -> list[dict]:
    with connect() as connection:
        if status:
            rows = connection.execute(
                "SELECT * FROM donations WHERE status = ? ORDER BY created_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = connection.execute(
                "SELECT * FROM donations ORDER BY created_at DESC"
            ).fetchall()
    return [dict(row) for row in rows]

def transition(donation_id: str, from_status: str, to_status: str,
               reserved_by: str | None = None) -> dict | None:
    delivered_at = datetime.now(timezone.utc).isoformat() if to_status == "delivered" else None
    with connect() as connection:
        cursor = connection.execute(
            """UPDATE donations
               SET status = ?, reserved_by = COALESCE(?, reserved_by),
                   delivered_at = COALESCE(?, delivered_at)
               WHERE id = ? AND status = ?""",
            (to_status, reserved_by, delivered_at, donation_id, from_status),
        )
        if cursor.rowcount != 1:
            return None
    return get_donation(donation_id)

def get_stats() -> dict:
    with connect() as connection:
        rows = connection.execute(
            "SELECT status, COUNT(*) AS n, COALESCE(SUM(quantity_kg), 0) AS kg "
            "FROM donations GROUP BY status"
        ).fetchall()
    counts = {status: 0 for status in ("available", "reserved", "delivered")}
    delivered_kg = 0.0
    for row in rows:
        counts[row["status"]] = row["n"]
        if row["status"] == "delivered":
            delivered_kg = round(float(row["kg"]), 2)
    return {
        **counts,
        "kilograms_delivered": delivered_kg,
        "estimated_servings": int((delivered_kg + 1e-9) / 0.35),
    }

def donation_count() -> int:
    with connect() as connection:
        return int(connection.execute("SELECT COUNT(*) FROM donations").fetchone()[0])
