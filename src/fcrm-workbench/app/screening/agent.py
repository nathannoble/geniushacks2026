"""M4 — Screening.

Checks each named party against the synthetic watchlist: exact match first,
then fuzzy match via rapidfuzz (pure string similarity, no API call), and
only calls Claude Haiku to triage the ambiguous middle band — cheap and fast
for the common cases, a real judgment call only where string similarity
alone can't decide.
"""
from __future__ import annotations

import json
import os

import psycopg2
from anthropic import Anthropic
from rapidfuzz import fuzz

from .schema import ScreeningMatch, ScreeningReport

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


# Scores are rapidfuzz's token_sort_ratio, 0-100.
FUZZY_HIT_THRESHOLD = 95  # treat as a confirmed hit, skip triage
FUZZY_REVIEW_FLOOR = 80  # below this, treat as no match at all


def _load_watchlist() -> list[tuple[str, str, str]]:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT name, entity_type, list_name FROM watchlist_entries")
            return cur.fetchall()
    finally:
        conn.close()


def _triage_ambiguous_match(party_name: str, matched_name: str, score: float) -> tuple[str, float]:
    """One Haiku call for names in the fuzzy-but-not-certain band. Falls back
    to needs_review on any failure — silently clearing an ambiguous
    screening match is the wrong failure mode here."""
    prompt = (
        f'A screening check found a fuzzy name match (similarity {score:.0f}/100) between the '
        f'submitted party "{party_name}" and watchlist entry "{matched_name}". '
        "Decide whether this is likely the same person/entity or a coincidental near-match. "
        'Respond ONLY with JSON: {"status": "hit"|"no_hit"|"needs_review", "confidence": 0.0-1.0}.'
    )
    try:
        response = _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        parsed = json.loads(response.content[0].text)
        return parsed["status"], float(parsed["confidence"])
    except Exception:
        return "needs_review", 0.5


def screen_parties(case_id: str, party_names: list[str]) -> ScreeningReport:
    watchlist = _load_watchlist()
    matches: list[ScreeningMatch] = []

    for party in party_names:
        best_name, best_score = None, 0.0
        for name, _entity_type, _list_name in watchlist:
            score = fuzz.token_sort_ratio(party.lower(), name.lower())
            if score > best_score:
                best_name, best_score = name, score

        if best_score >= FUZZY_HIT_THRESHOLD:
            matches.append(
                ScreeningMatch(
                    party_name=party,
                    status="hit",
                    matched_entry=best_name,
                    match_type="exact" if best_score == 100 else "fuzzy",
                    confidence=best_score / 100,
                )
            )
        elif best_score >= FUZZY_REVIEW_FLOOR:
            status, confidence = _triage_ambiguous_match(party, best_name, best_score)
            matches.append(
                ScreeningMatch(
                    party_name=party,
                    status=status,
                    matched_entry=best_name,
                    match_type="fuzzy",
                    confidence=confidence,
                )
            )
        else:
            matches.append(
                ScreeningMatch(party_name=party, status="no_hit", matched_entry=None, confidence=1.0)
            )

    return ScreeningReport(case_id=case_id, matches=matches)
