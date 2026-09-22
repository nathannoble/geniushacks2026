"""M9 — persistence: the notification log and the SLA clock, both backed by
the same `cases`/`notifications` tables everything else uses.
"""
from __future__ import annotations

import datetime as dt
import os
from typing import Optional

import psycopg2
import psycopg2.extras

# POL-010: FCRM targets a two-business-day turnaround from submission to
# committee decision. Modeled here as 48 wall-clock hours, not business
# hours — a reasonable simplification for the synthetic hackathon scope.
SLA_TARGET_HOURS = 48


def _connect():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def insert_notification(case_id: str, persona: str, event_type: str, message: str, channel: str = "log") -> None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO notifications (case_id, persona, event_type, message, channel) "
                "VALUES (%s, %s, %s, %s, %s)",
                (case_id, persona, event_type, message, channel),
            )
        conn.commit()
    finally:
        conn.close()


def list_notifications(case_id: str) -> list[dict]:
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT persona, event_type, message, channel, sent_at FROM notifications "
                "WHERE case_id = %s ORDER BY sent_at",
                (case_id,),
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


def compute_sla(case_id: str, status: str, created_at: dt.datetime, now: Optional[dt.datetime] = None) -> dict:
    """Pure function — no DB access — so the SLA math itself is testable
    without mocking a connection. `now` is injectable for tests; defaults to
    the real current time."""
    now = now or dt.datetime.now(dt.timezone.utc)
    elapsed_hours = (now - created_at).total_seconds() / 3600
    return {
        "case_id": case_id,
        "status": status,
        "elapsed_hours": round(elapsed_hours, 1),
        "target_hours": SLA_TARGET_HOURS,
        "breached": status != "closed" and elapsed_hours > SLA_TARGET_HOURS,
    }


def get_sla_status(case_id: str) -> Optional[dict]:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT created_at, status FROM cases WHERE case_id = %s", (case_id,))
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return None
    created_at, status = row
    return compute_sla(case_id, status, created_at)
