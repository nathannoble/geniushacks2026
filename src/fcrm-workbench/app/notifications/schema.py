from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class GoldenCase(BaseModel):
    name: str
    description: str
    document_path: Optional[str] = None  # for extraction-stage checks
    submission: dict = Field(default_factory=dict)
    expected_facts: list[str] = Field(default_factory=list)  # substrings expected among extracted values
    expected_top_policy_id: Optional[str] = None  # for retrieval-stage checks
    factor_scores: Optional[dict[str, int]] = None  # for scoring-stage checks
    has_unresolved_screening_hit: bool = False
    expected_tier: Optional[str] = None


class CaseEvalResult(BaseModel):
    name: str
    extraction_recall: Optional[float] = None
    retrieval_top1_correct: Optional[bool] = None
    scoring_tier_correct: Optional[bool] = None
    passed: bool
    notes: list[str] = Field(default_factory=list)


class EvalReport(BaseModel):
    results: list[CaseEvalResult]
    pass_rate: float
