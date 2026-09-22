"""M0 — the shared state every node in the orchestrator graph reads and
writes. Every field is a plain dict/list of dicts (not the Pydantic models
each module defines) because LangGraph state must be JSON-serializable for
the checkpointer — nodes convert to/from each module's Pydantic model
internally, at the boundary.
"""
from __future__ import annotations

from typing import Any, Optional, TypedDict


class CaseGraphState(TypedDict, total=False):
    case_id: str
    status: str  # "validated" | "needs_more_information" | "closed"
    submission: dict
    documents: list[dict]
    change_type: Optional[str]
    missing_fields: list[str]

    facts: list[dict]  # M2 output — ExtractedFact dicts
    citations: list[dict]  # M3 output — PolicyCitation dicts
    screening_report: dict  # M4 output — ScreeningReport dict

    factor_scores: dict[str, int]  # mapped inputs for M5
    risk_score: dict  # M5 output — RiskScore dict

    memo: dict  # M6 output — DraftMemo dict

    gate1_decision: dict  # {"action": "finalize"|"rfi", "notes": str, "actor": str}
    gate2_decision: dict  # {"outcome": str, "conditions": list[str], "actor": str}
    rfi_notes: Optional[str]
    final_outcome: Optional[str]
