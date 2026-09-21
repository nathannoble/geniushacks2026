"""M3 — Policy & Regulatory Retrieval.

Retrieves the specific policy sections that apply to a case, using the local
hashing embedding (app.retrieval.embeddings) against pgvector — no Voyage or
Cohere API keys needed. Cosine similarity via pgvector's <=> operator stands
in for the blueprint's rerank step; sufficient at the size of policy library
this project ships with (a handful of synthetic documents).
"""
from __future__ import annotations

import os

import psycopg2
from pgvector.psycopg2 import register_vector

from .embeddings import embed
from .schema import PolicyCitation


def retrieve_policy_citations(query_text: str, top_k: int = 5) -> list[PolicyCitation]:
    vector = embed(query_text)
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    register_vector(conn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT policy_id, title, chunk_text, 1 - (embedding <=> %s::vector) AS similarity
                FROM policy_chunks
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (vector, vector, top_k),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        PolicyCitation(policy_id=r[0], title=r[1], excerpt=r[2], similarity=round(r[3], 4))
        for r in rows
    ]
