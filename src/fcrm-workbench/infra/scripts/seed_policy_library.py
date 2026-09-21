"""Chunk the synthetic policy library (infra/policy-library/*.md) and embed
it into the policy_chunks table. Idempotent — safe to re-run after editing
or adding policy documents.

Run from the repo root with the venv active and DATABASE_URL set:
    python scripts/seed_policy_library.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import psycopg2
from pgvector.psycopg2 import register_vector

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.retrieval.embeddings import embed  # noqa: E402

POLICY_DIR = Path(__file__).resolve().parent.parent / "infra" / "policy-library"


def _chunks(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def main() -> None:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    register_vector(conn)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM policy_chunks")
            for path in sorted(POLICY_DIR.glob("*.md")):
                policy_id = path.stem.split("_", 1)[0]
                lines = path.read_text().splitlines()
                title = lines[0].lstrip("# ").strip()
                body = "\n".join(lines[1:])

                count = 0
                for chunk in _chunks(body):
                    vector = embed(chunk)
                    cur.execute(
                        "INSERT INTO policy_chunks (policy_id, title, chunk_text, embedding) "
                        "VALUES (%s, %s, %s, %s)",
                        (policy_id, title, chunk, vector),
                    )
                    count += 1
                print(f"Seeded {path.name}: {count} chunks")
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
