"""M1 — change-type classification.

One Claude Haiku call that normalizes the submitter's free-text description
into the fixed FCRM change-type taxonomy. This is triage, not a judgment
call: a low-confidence result is treated by the caller as an incomplete
field (needs-more-information), never silently guessed past.
"""
from __future__ import annotations

import json
import os

from anthropic import Anthropic

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


def classify_change_type(description: str, hint: str | None = None) -> tuple[ChangeType, float]:
    """Returns (ChangeType, confidence). Falls back to (OTHER, 0.0) on any
    failure — callers treat low confidence as needs-review, not as an error,
    so a model or parsing hiccup degrades gracefully into an RFI rather than
    a hard failure."""
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
        raw = response.content[0].text
        parsed = json.loads(raw)
        change_type = ChangeType(parsed["change_type"])
        confidence = float(parsed["confidence"])
        return change_type, confidence
    except Exception:
        return ChangeType.OTHER, 0.0
