"""Shared JSON-parsing helpers.

Claude sometimes wraps a JSON response in a ```json ... ``` code fence
despite being told to respond with JSON only. Every module that asks Claude
for JSON should strip that before parsing — a fenced response is not a
parse failure, and treating it as one silently discards good output (this
is exactly the bug M2's extraction hit first).
"""
from __future__ import annotations

import json
from typing import Any


def strip_json_fence(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    return cleaned


def parse_json_safely(text: str, default: Any) -> Any:
    """Returns `default` on any parse failure rather than raising — callers
    should treat that as "couldn't understand the model", not crash."""
    try:
        return json.loads(strip_json_fence(text))
    except (json.JSONDecodeError, TypeError):
        return default
