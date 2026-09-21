from unittest.mock import patch

from app.screening.agent import screen_parties

_FAKE_WATCHLIST = [
    ("Marcus J. Holloway", "individual", "Synthetic Sanctions List"),
    ("Northgate Trading Consortium", "organization", "Synthetic Sanctions List"),
]


@patch("app.screening.agent._load_watchlist", return_value=_FAKE_WATCHLIST)
def test_exact_match_is_a_hit(mock_watchlist):
    report = screen_parties("FCRM-2026-0001", ["Marcus J. Holloway"])

    assert report.matches[0].status == "hit"
    assert report.matches[0].match_type == "exact"
    assert report.matches[0].confidence == 1.0


@patch("app.screening.agent._load_watchlist", return_value=_FAKE_WATCHLIST)
def test_unrelated_name_is_no_hit(mock_watchlist):
    report = screen_parties("FCRM-2026-0001", ["Green Leaf Dispensary LLC"])

    assert report.matches[0].status == "no_hit"
    assert report.matches[0].matched_entry is None


@patch("app.screening.agent._triage_ambiguous_match", return_value=("needs_review", 0.6))
@patch("app.screening.agent._load_watchlist", return_value=_FAKE_WATCHLIST)
def test_fuzzy_match_in_ambiguous_band_goes_to_triage(mock_watchlist, mock_triage):
    # "Marcus Holloway" (no middle initial) is close but not exact.
    report = screen_parties("FCRM-2026-0001", ["Marcus Holloway"])

    mock_triage.assert_called_once()
    assert report.matches[0].status == "needs_review"
    assert report.matches[0].match_type == "fuzzy"
