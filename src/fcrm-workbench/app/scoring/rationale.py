"""M5 — rationale generation.

One Claude call that explains an already-computed score in plain language.
It receives the full factor breakdown and is explicitly instructed to
describe it, not to produce or adjust the number — the score itself always
comes from scorecard.py's deterministic math, never from this call.
"""
from __future__ import annotations

import os

from anthropic import Anthropic

from app.common.json_utils import get_response_text
from .schema import RiskScore

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


_SYSTEM_PROMPT = (
    "You write the plain-language rationale for an FCRM risk score that has "
    "already been computed by a deterministic scorecaahe factor breakdown you're given. Do not propose a different "
    "score or tier — your only job is to explain the one you're given, in 3-5 "
    "sentences, in language a committee member without a quantitative background "
    "can follow."
)


def generate_rationale(score: RiskScore) -> str:
    factor_lines = "\n".join(
        f"- {f.name}: raw {f.raw_score}/4, weight {f.weight}, contributes {f.contribution}"
        for f in score.factors
    )
    floor_note = " (floored to High due to an unresolved screening hit)" if score.floored_by_screening_hit else ""
    prompt = (
        f"Case {score.case_id} scored {score.weighted_total} -> tier {score.tier}{floor_note}.\n\n"
        f"Factor breakdown:\n{factor_lines}"
    )

    try:
        response = _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return get_response_text(response).strip()
    except Exception:
        return (
            f"Automated rationale unavailable. Weighted total {score.weighted_total} "
            f"produced tier {score.tier} based on the factor breakdown above."
        )
