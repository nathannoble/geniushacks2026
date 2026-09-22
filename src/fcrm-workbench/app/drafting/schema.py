from __future__ import annotations

from pydantic import BaseModel, Field


class MemoCitation(BaseModel):
    source: str  # e.g. "M2 extraction: file.pdf, page 1" or "M3 policy: POL-100"
    excerpt: str


class DraftMemo(BaseModel):
    case_id: str
    risk_tier: str
    summary: str
    citations: list[MemoCitation] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    suggested_conditions: list[str] = Field(default_factory=list)
