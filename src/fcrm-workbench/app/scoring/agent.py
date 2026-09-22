"""M5 — Risk Scoring. Single entry point.

Computes the deterministic score first, then asks Claude to explain it. The
score and tier never come from the model — only the rationale does.
"""
from __future__ import annotations

from .rationale import generate_rationale
from .schema import RiskScore
from .scorecard import score_case


def compute_risk_score(
    case_id: str, factor_scores: dict[str, int], has_unresolved_screening_hit: bool
) -> RiskScore:
    score = score_case(case_id, factor_scores, has_unresolved_screening_hit)
    score.rationale = generate_rationale(score)
    return score
