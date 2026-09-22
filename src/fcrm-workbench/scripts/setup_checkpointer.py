"""Run once to create LangGraph's checkpointer tables in Postgres — a
one-time step separate from infra/init-db's own migrations, since
PostgresSaver manages its own schema.

    python scripts/setup_checkpointer.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.orchestrator.graph import get_checkpointer  # noqa: E402


def main() -> None:
    with get_checkpointer() as checkpointer:
        checkpointer.setup()
    print("LangGraph checkpointer tables created.")


if __name__ == "__main__":
    main()
