"""M1 — persistence.

Plain psycopg2 rather than an ORM, to keep intake dependency-light; other
modules are free to use SQLAlchemy against the same `cases` table.
"""
from __future__ import annotations

import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras


@contextmanager
def get_connection():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def next_case_sequence(conn, year: int) -> int:
    """Next per-year sequence number for the human-readable case ID, e.g. the
    7 in FCRM-2026-0007. A dedicated sequence row per year keeps IDs dense
    and auditable even if a case insert later fails in the same transaction."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO case_id_sequences (year, last_value)
            VALUES (%s, 1)
            ON CONFLICT (year)
            DO UPDATE SET last_value = case_id_sequences.last_value + 1
            RETURNING last_value
            """,
            (year,),
        )
        return cur.fetchone()[0]


def insert_case(
    conn,
    case_id: str,
    status: str,
    change_type: str | None,
    change_type_confidence: float | None,
    missing_fields: list[str],
    submission: dict,
    documents: list[dict],
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cases (case_id, status, change_type, change_type_confidence,
                                missing_fields, submission, documents)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                case_id,
                status,
                change_type,
                change_type_confidence,
                psycopg2.extras.Json(missing_fields),
                psycopg2.extras.Json(submission),
                psycopg2.extras.Json(documents),
            ),
        )
