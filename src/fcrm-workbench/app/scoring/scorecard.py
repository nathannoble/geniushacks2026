"""M5 — versioned weighted scorecard (v1).

Deterministic: given the same factor inputs, this always produces the same
tier and weighted total. Weights and thresholds are taken directly from
POL-045 (infra/policy-library/POL-045_high-cash-intensity-risk-criteria.md)
so the score is traceable back to a cited policy rather than an opaque
number — bump VERSION and keep the old logic in a v2 module if the weights
ever need to change, so the eval harness (M8) can regression-test against a
fixed version.
"""
from __future__ import annotations

from .schema import RiskScore, ScoreFactor

VERSION = "v1"

# Weights from POL-045. Must sum to 1.0 — a factor's raw 0-4 score, at
# weight 1.0 total, produces a weighted total on the same 0-4 scale as the
# policy's tier thresholds below.
WEIGHTS = {
    "cash_percentage": 0.30,
    "jurisdiction_risk": 0.20,
    "screening_hit_severity": 0.25,
    "product_novelty": 0.15,
    "prior_exam_findings": 0.10,
}

FACTOR_ORDER = list(WEIGHTS.keys())

assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9, "POL-045 weights must sum to 1.0"


def _tier_for_total(total: float) -> str:
    # Thresholds from POL-045: 0.0-1.0 Low, 1.01-2.0 Medium, 2.01-3.0 High, >3.0 Critical.
    if total <= 1.0:
        return "Low"
    if total <= 2.0:
        return "Medium"
    if total <= 3.0:
        return "High"
    return "Critical"


def score_case(
    case_id: str, factor_scores: dict[str, int], has_unresolved_screening_hit: bool
) -> RiskScore:
    """factor_scores maps each name in FACTOR_ORDER to a raw 0-4 score.
    A missing factor defaults to 0 (lowest risk) rather than raising, so a
    partially-scored case still produces a — conservative — result instead
    of blocking on an incomplete caller."""
    factors: list[ScoreFactor] = []
    total = 0.0

    for name in FACTOR_ORDER:
        raw = max(0, min(4, factor_scores.get(name, 0)))  # clamp to policy's 0-4 range
        weight = WEIGHTS[name]
        contribution = round(raw * weight, 3)
        total += contribution
        factors.append(ScoreFactor(name=name, raw_score=raw, weight=weight, contribution=contribution))

    total = round(total, 3)
    tier = _tier_for_total(total)

    # POL-045: any unresolved sanctions/PEP hit floors the case at High,
    # regardless of the weighted total.
    floored = False
    if has_unresolved_screening_hit and tier not in ("High", "Critical"):
        tier = "High"
        floored = True

    return RiskScore(
        case_id=case_id,
        tier=tier,
        weighted_total=total,
        factors=factors,
        floored_by_screening_hit=floored,
    )
