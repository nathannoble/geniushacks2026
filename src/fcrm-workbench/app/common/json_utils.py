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


import re


def strip_json_fence(text: str) -> str:
    cleaned = text.strip()
    # Try finding markdown code block ```json ... ``` or ``` ... ```
    m = re.search(r"```(?:json)?\s*([\{\[].*?[\}\]])\s*```", cleaned, re.DOTALL)
    if m:
        return m.group(1).strip()

    # Try finding outermost {...} or [...]
    m = re.search(r"([\{\[].*[\}\]])", cleaned, re.DOTALL)
    if m:
        return m.group(1).strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    return cleaned


def parse_json_safely(text: str, default: Any) -> Any:
    """Returns `default` on any parse failure rather than raising — callers
    should treat that as "couldn't understand the model", not crash."""
    if not text or not isinstance(text, str):
        return default

    cleaned = text.strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    try:
        stripped = strip_json_fence(cleaned)
        return json.loads(stripped)
    except Exception:
        return default


def get_response_text(response: Any) -> str:
    """Extracts text content from an Anthropic model response, handling cases where
    ThinkingBlock precedes TextBlock in models with thinking enabled."""
    if hasattr(response, "content") and isinstance(response.content, list):
        for block in response.content:
            if getattr(block, "type", None) == "text" or hasattr(block, "text"):
                return block.text
    return ""

