"""M8 — scoring functions for the golden-case regression suite.

Deliberately simple and dependency-free rather than wired to Ragas/DeepEval's
LLM-judge metrics: those default to an OpenAI judge model and need their own
provider configuration to point at Claude instead, which isn't verifiable
without live testing against real API behavior. These functions need no
extra API calls beyond what M2/M3/M5 already make, are easy to read, and
run fast — swap in Ragas/DeepEval metrics later behind the same function
signatures if richer LLM-judged scoring turns out to be worth the added
complexity.
"""
from __future__ import annotations

from app.extraction.schema import ExtractedFact


def extraction_recall(facts: list[ExtractedFact], expected_substrings: list[str]) -> float:
    """Fraction of expected substrings found in at least one extracted
    fact's value (case-insensitive substring match). 1.0 if nothing was
    expected, so a case with no extraction assertions doesn't fail on this."""
    if not expected_substrings:
        return 1.0
    values = [f.value.lower() for f in facts]
    found = sum(1 for expected in expected_substrings if any(expected.lower() in v for v in values))
    return found / len(expected_substrings)


def retrieval_top1_correct(top_policy_id: str | None, expected_policy_id: str) -> bool:
    return top_policy_id == expected_policy_id


def scoring_tier_correct(actual_tier: str, expected_tier: str) -> bool:
    return actual_tier == expected_tier
