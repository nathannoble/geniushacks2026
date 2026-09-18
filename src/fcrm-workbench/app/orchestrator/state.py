from typing import TypedDict, Any


class CaseState(TypedDict, total=False):
    case_id: str
    facts: dict[str, Any]
    citations: list[dict]
    screening_report: dict
    score: dict
    memo: dict
    status: str