from unittest.mock import patch

from app.scoring.agent import compute_risk_score
from app.scoring.scorecard import WEIGHTS, score_case


def test_all_zero_factors_is_low_risk():
    result = score_case("T-1", {}, has_unresolved_screening_hit=False)

    assert result.weighted_total == 0.0
    assert result.tier == "Low"
    assert result.floored_by_screening_hit is False


def test_all_twos_lands_exactly_on_medium_high_boundary():
    factors = {name: 2 for name in WEIGHTS}
    result = score_case("T-2", factors, has_unresolved_screening_hit=False)

    assert result.weighted_total == 2.0
    assert result.tier == "Medium"  # policy: 1.01-2.0 is Medium, boundary is inclusive


def test_all_threes_is_high():
    factors = {name: 3 for name in WEIGHTS}
    result = score_case("T-3", factors, has_unresolved_screening_hit=False)

    assert result.weighted_total == 3.0
    assert result.tier == "High"


def test_all_fours_is_critical():
    factors = {name: 4 for name in WEIGHTS}
    result = score_case("T-4", factors, has_unresolved_screening_hit=False)

    assert result.weighted_total == 4.0
    assert result.tier == "Critical"


def test_out_of_range_scores_are_clamped_not_rejected():
    factors = {name: 99 for name in WEIGHTS}
    result = score_case("T-5", factors, has_unresolved_screening_hit=False)

    assert result.weighted_total == 4.0  # clamped to 4, same as test_all_fours
    for f in result.factors:
        assert f.raw_score == 4


def test_unresolved_screening_hit_floors_low_score_to_high():
    result = score_case("T-6", {}, has_unresolved_screening_hit=True)

    assert result.weighted_total == 0.0  # the underlying math is untouched
    assert result.tier == "High"  # but the reported tier is floored
    assert result.floored_by_screening_hit is True


def test_screening_hit_does_not_downgrade_an_already_critical_case():
    factors = {name: 4 for name in WEIGHTS}
    result = score_case("T-7", factors, has_unresolved_screening_hit=True)

    assert result.tier == "Critical"
    assert result.floored_by_screening_hit is False  # nothing to floor, it's already above High


@patch("app.scoring.agent.generate_rationale", return_value="Mocked rationale.")
def test_agent_attaches_rationale_without_changing_the_score(mock_rationale):
    result = compute_risk_score("T-8", {"cash_percentage": 3}, has_unresolved_screening_hit=False)

    mock_rationale.assert_called_once()
    assert result.rationale == "Mocked rationale."
    assert result.tier == score_case("T-8", {"cash_percentage": 3}, False).tier
