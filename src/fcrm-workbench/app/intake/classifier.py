"""M1 — change-type classification.

One Claude Haiku call that normalizes the submitter's free-text description
into the fixed FCRM change-type taxonomy. This is triage, not a judgment
call: a low-confidence result is treated by the caller as an incomplete
field (needs-more-information), never silently guessed past.
"""
from __future__ import annotations

import os

from anthropic import Anthropic

from app.common.json_utils import get_response_text, parse_json_safely
from .schema import ChangeType

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


_TAXONOMY = [c.value for c in ChangeType]

_SYSTEM_PROMPT = (
    "You are a compliance intake classifier for a bank's Financial Crimes "
    "Risk Management (FCRM) team. Classify the requested change into exactly "
    f"one of these categories: {', '.join(_TAXONOMY)}.\n"
    'Respond ONLY with JSON: {"change_type": "<one of the categories>", "confidence": <0.0-1.0>}\n'
    'Use "other" with low confidence if the description does not clearly fit.'
)


_HINT_MAP = {
    "new_product": ChangeType.NEW_PRODUCT,
    "new_product_launch": ChangeType.NEW_PRODUCT,
    "new_geography": ChangeType.NEW_GEOGRAPHY,
    "geographic_expansion": ChangeType.NEW_GEOGRAPHY,
    "new_customer_segment": ChangeType.NEW_CUSTOMER_SEGMENT,
    "customer_segment_expansion": ChangeType.NEW_CUSTOMER_SEGMENT,
    "product_modification": ChangeType.PRODUCT_MODIFICATION,
    "parameter_change": ChangeType.PRODUCT_MODIFICATION,
    "channel_modification": ChangeType.PRODUCT_MODIFICATION,
    "vendor_relationship": ChangeType.VENDOR_RELATIONSHIP,
    "policy_change": ChangeType.POLICY_CHANGE,
}


def classify_change_type(description: str, hint: str | None = None) -> tuple[ChangeType, float]:
    """Returns (ChangeType, confidence). Falls back to submitter hint or (OTHER, 0.0) on any
    failure — callers treat low confidence as needs-review, not as an error."""
    if not description:
        return ChangeType.OTHER, 0.0

    user_content = description
    if hint:
        user_content += f"\n\n(Submitter-provided change type hint: {hint})"

    try:
        response = _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )
        raw = get_response_text(response)
        parsed = parse_json_safely(raw, default=None)
        if parsed is not None:
            val = str(parsed.get("change_type", "")).strip().lower().replace(" ", "_").replace("-", "_")
            try:
                change_type = ChangeType(val)
            except ValueError:
                change_type = ChangeType.OTHER
            confidence = float(parsed.get("confidence", 0.0))
            if change_type != ChangeType.OTHER and confidence >= 0.6:
                return change_type, confidence
    except Exception as exc:
        print(f"[classifier] Exception: {exc}")

    # Fallback to normalized hint if provided and known
    if hint:
        hint_norm = hint.strip().lower().replace(" ", "_").replace("-", "_")
        if hint_norm in _HINT_MAP:
            return _HINT_MAP[hint_norm], 0.85

    return ChangeType.OTHER, 0.0
