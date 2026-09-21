from __future__ import annotations

from pydantic import BaseModel, Field


class ScreeningMatch(BaseModel):
    party_name: str
    status: str  # "hit" | "no_hit" | "needs_review"
    matched_entry: str | None = None
    match_type: str | None = None  # "exact" | "fuzzy" | None
    confidence: float


class ScreeningReport(BaseModel):
    case_id: str
    matches: list[ScreeningMatch] = Field(default_factory=list)
