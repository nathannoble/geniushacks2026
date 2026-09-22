"""Chunk the synthetic policy library (infra/policy-library/*.md), compute
corpus-wide IDF weights across every chunk, and embed everything into the
policy_chunks table using those weights. Idempotent — safe to re-run after
editing or adding policy documents (re-running recomputes IDF too, since
adding a document changes the corpus statistics every existing embedding
depends on).

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
from app.retrieval.embeddings import compute_idf, embed  # noqa: E402
from app.retrieval.idf_store import save_idf_weights  # noqa: E402

POLICY_DIR = Path(__file__).resolve().parent.parent / "infra" / "policy-library"


def _chunks(text: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _load_all_chunks() -> list[tuple[str, str, str]]:
    """Returns (policy_id, title, chunk_text) for every chunk in the
    library, in file order — read once so IDF can be computed from the
    whole corpus before anything is embedded."""
    all_chunks = []
    for path in sorted(POLICY_DIR.glob("*.md")):
        policy_id = path.stem.split("_", 1)[0]
        lines = path.read_text().splitlines()
        title = lines[0].lstrip("# ").strip()
        body = "\n".join(lines[1:])
        for chunk in _chunks(body):
            all_chunks.append((policy_id, title, chunk))
    return all_chunks


def main() -> None:
    all_chunks = _load_all_chunks()
    if not all_chunks:
        print(f"No policy documents found in {POLICY_DIR}")
        return

    idf = compute_idf([chunk_text for _, _, chunk_text in all_chunks])
    save_idf_weights(idf)
    print(f"Computed IDF over {len(all_chunks)} chunks, {len(idf)} distinct terms")

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    register_vector(conn)
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM policy_chunks")
            counts: dict[str, int] = {}
            for policy_id, title, chunk_text in all_chunks:
                vector = embed(chunk_text, idf=idf)
                cur.execute(
                    "INSERT INTO policy_chunks (policy_id, title, chunk_text, embedding) "
                    "VALUES (%s, %s, %s, %s)",
                    (policy_id, title, chunk_text, vector),
                )
                counts[policy_id] = counts.get(policy_id, 0) + 1
        conn.commit()
        for policy_id, count in counts.items():
            print(f"Seeded {policy_id}: {count} chunks")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
