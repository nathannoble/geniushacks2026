"""M9 — notification message templates, keyed by event_type. Plain Python
format strings rather than a templating engine — the point here is a
synthetic notification stub matching the hackathon's synthetic-data scope,
not a real messaging system.
"""
from __future__ import annotations

TEMPLATES = {
    "case_submitted": "Case {case_id} has been submitted and is now under FCRM review.",
    "needs_more_information": "Case {case_id} needs more information before FCRM can continue review: {detail}",
    "awaiting_gate1_review": "Case {case_id} has a draft assessment ready for analyst review.",
    "awaiting_gate2_review": "Case {case_id} has been finalized by the analyst and is ready for committee decision.",
    "case_decided": "Case {case_id} has been decided: {detail}.",
}

_DEFAULT_TEMPLATE = "Case {case_id}: {event_type}"


def render(event_type: str, case_id: str, detail: str = "") -> str:
    template = TEMPLATES.get(event_type, _DEFAULT_TEMPLATE)
    return template.format(case_id=case_id, detail=detail, event_type=event_type)
