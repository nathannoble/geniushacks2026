"""M3 — IDF persistence.

The corpus IDF weights are computed once, from the whole policy library, by
scripts/seed_policy_library.py, and stored here. app.retrieval.agent loads
them before embedding a query — the query and the corpus chunks must be
weighted with the exact same IDF table, or their cosine similarity isn't
comparing like with like.
"""
from __future__ import annotations

import os

import psycopg2
import psycopg2.extras


def save_idf_weights(idf: dict[str, float]) -> None:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM policy_idf")
            if idf:
                psycopg2.extras.execute_values(
                    cur, "INSERT INTO policy_idf (term, idf) VALUES %s", list(idf.items())
                )
        conn.commit()
    finally:
        conn.close()


def load_idf_weights() -> dict[str, float]:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT term, idf FROM policy_idf")
            rows = cur.fetchall()
    finally:
        conn.close()
    return dict(rows)
