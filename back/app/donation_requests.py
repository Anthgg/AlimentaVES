"""Persistence for authenticated donation requests and their review history."""

from uuid import UUID, uuid4

from psycopg import errors

from .database import connect


def init_requests_db() -> None:
    """Create request tables and indexes without altering existing records."""
    with connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS donation_requests (
                id UUID PRIMARY KEY,
                donation_id UUID NOT NULL
                    REFERENCES donations(id) ON DELETE RESTRICT,
                kitchen_id BIGINT NOT NULL
                    REFERENCES community_kitchens(id) ON DELETE RESTRICT,
                requested_by UUID NOT NULL
                    REFERENCES auth_users(id) ON DELETE RESTRICT,
                status VARCHAR(12) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
                submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                reviewed_by UUID REFERENCES auth_users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMPTZ
            )
        """)
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS donation_requests_pending_kitchen_idx "
            "ON donation_requests(donation_id, kitchen_id) WHERE status = 'pending'"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS donation_requests_approved_donation_idx "
            "ON donation_requests(donation_id) WHERE status = 'approved'"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS donation_requests_requester_history_idx "
            "ON donation_requests(requested_by, submitted_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS donation_requests_kitchen_history_idx "
            "ON donation_requests(kitchen_id, submitted_at DESC)"
        )


_REQUEST_SELECT = """
    SELECT r.id, r.donation_id, r.kitchen_id, r.requested_by, r.status,
           r.submitted_at, r.reviewed_by, r.reviewed_at,
           d.status AS donation_status
    FROM donation_requests r
    JOIN donations d ON d.id = r.donation_id
"""


def create_request(donation_id: UUID, kitchen_id: int, account_id: UUID) -> dict | None:
    """Create a pending request only while the donation remains available."""
    try:
        with connect() as conn:
            donation = conn.execute(
                "SELECT status, expires_at > NOW() AS not_expired "
                "FROM donations WHERE id = %s FOR UPDATE",
                (donation_id,),
            ).fetchone()
            if (
                donation is None
                or donation["status"] != "available"
                or not donation["not_expired"]
            ):
                return None
            row = conn.execute(
                """INSERT INTO donation_requests
                       (id, donation_id, kitchen_id, requested_by)
                   VALUES (%s, %s, %s, %s)
                   RETURNING id""",
                (uuid4(), donation_id, kitchen_id, account_id),
            ).fetchone()
            return conn.execute(
                _REQUEST_SELECT + " WHERE r.id = %s", (row["id"],)
            ).fetchone()
    except errors.UniqueViolation:
        return None


def list_requests(
    account_id: UUID | None = None, status: str | None = None
) -> list[dict]:
    clauses: list[str] = []
    params: list[object] = []
    if account_id is not None:
        clauses.append("r.requested_by = %s")
        params.append(account_id)
    if status is not None:
        clauses.append("r.status = %s")
        params.append(status)
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    with connect() as conn:
        return conn.execute(
            _REQUEST_SELECT + where + " ORDER BY r.submitted_at DESC, r.id",
            params,
        ).fetchall()


def get_request(request_id: UUID) -> dict | None:
    with connect() as conn:
        return conn.execute(
            _REQUEST_SELECT + " WHERE r.id = %s", (request_id,)
        ).fetchone()


def review_request(
    request_id: UUID, decision: str, reviewer_id: UUID
) -> tuple[dict | None, bool, str | None, list[dict]]:
    """Review once; approval reserves the donation with a row-locked transition.

    Returns (request, changed, conflict_reason, auto_rejected_requests). A
    competing approved request cannot reserve the same donation because the
    donation row is locked and the update is conditional on its status/expiry.
    """
    if decision not in {"approved", "rejected"}:
        raise ValueError("unsupported donation request decision")
    with connect() as conn:
        reference = conn.execute(
            "SELECT donation_id FROM donation_requests WHERE id = %s",
            (request_id,),
        ).fetchone()
        if reference is None:
            return None, False, None, []
        # All reviews for a donation lock it before locking request rows. This
        # consistent order serializes competing approvals without deadlocks.
        conn.execute(
            "SELECT id FROM donations WHERE id = %s FOR UPDATE",
            (reference["donation_id"],),
        ).fetchone()
        row = conn.execute(
            "SELECT id, donation_id, status FROM donation_requests "
            "WHERE id = %s FOR UPDATE",
            (request_id,),
        ).fetchone()
        if row is None:
            return None, False, None, []
        if row["status"] != "pending":
            result = conn.execute(
                _REQUEST_SELECT + " WHERE r.id = %s", (request_id,)
            ).fetchone()
            return result, False, "already_reviewed", []

        closed_requests: list[dict] = []

        if decision == "approved":
            reserved = conn.execute(
                """UPDATE donations
                   SET status = 'reserved'
                   WHERE id = %s AND status = 'available' AND expires_at > NOW()
                   RETURNING id""",
                (row["donation_id"],),
            ).fetchone()
            if reserved is None:
                return None, False, "donation_unavailable", []
            closed_requests = conn.execute(
                """UPDATE donation_requests
                   SET status = 'rejected', reviewed_by = %s, reviewed_at = NOW()
                   WHERE donation_id = %s AND id <> %s AND status = 'pending'
                   RETURNING id, requested_by""",
                (reviewer_id, row["donation_id"], request_id),
            ).fetchall()

        reviewed = conn.execute(
            """UPDATE donation_requests
               SET status = %s, reviewed_by = %s, reviewed_at = NOW()
               WHERE id = %s AND status = 'pending'
               RETURNING id""",
            (decision, reviewer_id, request_id),
        ).fetchone()
        if reviewed is None:
            return None, False, "already_reviewed", []
        result = conn.execute(
            _REQUEST_SELECT + " WHERE r.id = %s", (request_id,)
        ).fetchone()
        return result, True, None, closed_requests
