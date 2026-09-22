"""M0 — persistence.

Plain psycopg2, consistent with the other modules. Three responsibilities:
mapping a case_id to its LangGraph thread_id (so a later gate decision can
find the right paused graph), the append-only approvals audit log every
Gate 1/Gate 2 action lands in, and recording the final case outcome.
"""
from __future__ import annotations

import os
from typing import Optional

import psycopg2
import psycopg2.extras


def _connect():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def set_thread_id(case_id: str, thread_id: str) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE cases SET thread_id = %s WHERE case_id = %s", (thread_id, case_id))
        conn.commit()
    finally:
        conn.close()


def get_thread_id(case_id: str) -> str:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT thread_id FROM cases WHERE case_id = %s", (case_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    if not row or not row[0]:
        raise ValueError(f"No thread_id on record for case {case_id}")
    return row[0]


def record_gate_decision(case_id: str, gate: str, decision: dict) -> None:
    """Every Gate 1/Gate 2 action lands here with actor and timestamp,
    regardless of outcome — this table is the audit trail."""
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO approvals (case_id, gate, actor, decision) VALUES (%s, %s, %s, %s)",
                (case_id, gate, decision.get("actor"), psycopg2.extras.Json(decision)),
            )
        conn.commit()
    finally:
        conn.close()


def finalize_case(case_id: str, outcome: str) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE cases SET status = 'closed', final_outcome = %s WHERE case_id = %s",
                (outcome, case_id),
            )
        conn.commit()
    finally:
        conn.close()


def get_case_row(case_id: str) -> Optional[dict]:
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM cases WHERE case_id = %s", (case_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    return dict(row) if row else None
