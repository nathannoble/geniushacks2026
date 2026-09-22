from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ScoreFactor(BaseModel):
    name: str
    raw_score: int  # 0-4
    weight: float
    contribution: float


class RiskScore(BaseModel):
    case_id: str
    tier: str  # "Low" | "Medium" | "High" | "Critical"
    weighted_total: float
    factors: list[ScoreFactor] = Field(default_factory=list)
    floored_by_screening_hit: bool = False
    rationale: Optional[str] = None
