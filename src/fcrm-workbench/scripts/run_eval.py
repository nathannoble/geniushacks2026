"""M8 — CI regression job. Runs every golden case and exits non-zero if any
case doesn't meet its expected output — plug this into a CI workflow so a
change that regresses extraction, retrieval, or scoring fails the build.

Needs a real ANTHROPIC_API_KEY and a live, seeded Postgres (including the
policy library — see scripts/seed_policy_library.py) to actually run.

    python scripts/run_eval.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.eval.harness import run_all  # noqa: E402


def main() -> int:
    report = run_all()

    for result in report.results:
        status = "PASS" if result.passed else "FAIL"
        print(f"[{status}] {result.name}")
        for note in result.notes:
            print(f"    - {note}")

    passed_count = sum(1 for r in report.results if r.passed)
    print(f"\n{passed_count}/{len(report.results)} golden cases passed ({report.pass_rate:.0%})")

    return 0 if report.pass_rate == 1.0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
