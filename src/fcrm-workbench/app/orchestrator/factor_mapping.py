"""M0 — factor mapping.

Rule-based mapping from M2's extracted facts and M4's screening report into
the 0-4 factor scores M5's scorecard needs. This is a first-pass heuristic,
not a rigorous model — it exists to make the graph runnable end to end now.
The weights and thresholds it feeds into are still POL-045's real,
policy-derived numbers; only the *inputs* to those weights are heuristic.
Revisit the regexes/tables below as real case data reveals gaps.
"""
from __future__ import annotations

import re
from typing import Optional

from app.extraction.schema import ExtractedFact
from app.screening.schema import ScreeningReport

# Matches "75-85%" or "80%" inside a fact's free-text value.
_PERCENT_RE = re.compile(r"(\d{1,3})\s*-\s*(\d{1,3})\s*%|(\d{1,3})\s*%")


def _cash_percentage_score(facts: list[ExtractedFact]) -> int:
    """POL-045 bands: <20% -> 0, 20-40% -> 1, 40-60% -> 2, 60-80% -> 3, >80% -> 4."""
    best_pct: Optional[float] = None
    for f in facts:
        if f.field != "transaction_type" or "cash" not in f.value.lower():
            continue
        match = _PERCENT_RE.search(f.value)
        if not match:
            continue
        if match.group(1) and match.group(2):
            pct = (float(match.group(1)) + float(match.group(2))) / 2
        else:
            pct = float(match.group(3))
        best_pct = max(best_pct or 0, pct)

    if best_pct is None:
        return 0  # no cash-percentage evidence found — don't assume risk
    if best_pct < 20:
        return 0
    if best_pct < 40:
        return 1
    if best_pct < 60:
        return 2
    if best_pct < 80:
        return 3
    return 4


# Placeholder jurisdiction risk table (0-4), not a real supervisory rating —
# extend as the policy library grows. Unlisted jurisdictions default to 2
# (moderate) rather than 0, since "unknown" shouldn't score as risk-free.
_JURISDICTION_RISK = {
    "colorado": 2,
    "michigan": 2,
}
_DEFAULT_JURISDICTION_RISK = 2


def _jurisdiction_risk_score(facts: list[ExtractedFact]) -> int:
    scores = [
        _JURISDICTION_RISK.get(f.value.lower(), _DEFAULT_JURISDICTION_RISK)
        for f in facts
        if f.field == "jurisdiction"
    ]
    return max(scores) if scores else 0


def _screening_hit_severity_score(screening: ScreeningReport) -> int:
    statuses = {m.status for m in screening.matches}
    if "hit" in statuses:
        return 4
    if "needs_review" in statuses:
        return 2
    return 0


# Change type -> novelty score. New products/segments are the most novel;
# modifications to something already banked are the least.
_NOVELTY_BY_CHANGE_TYPE = {
    "new_product": 3,
    "new_customer_segment": 3,
    "new_geography": 2,
    "vendor_relationship": 2,
    "product_modification": 1,
    "policy_change": 1,
    "other": 2,
}


def _product_novelty_score(change_type: Optional[str]) -> int:
    if not change_type:
        return 2  # unknown change type — treat as moderately novel, not zero
    return _NOVELTY_BY_CHANGE_TYPE.get(change_type, 2)


def map_facts_to_factor_scores(
    facts: list[ExtractedFact], screening: ScreeningReport, change_type: Optional[str]
) -> dict[str, int]:
    return {
        "cash_percentage": _cash_percentage_score(facts),
        "jurisdiction_risk": _jurisdiction_risk_score(facts),
        "screening_hit_severity": _screening_hit_severity_score(screening),
        "product_novelty": _product_novelty_score(change_type),
        # No data source yet for prior exam findings (would come from M3's
        # precedent-case retrieval) — fixed placeholder until that's built.
        "prior_exam_findings": 1,
    }
