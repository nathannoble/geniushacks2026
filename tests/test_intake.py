"""Unit tests for M1. The DB and classifier calls are monkeypatched so these
run without a live Postgres instance or an Anthropic API key."""
from unittest.mock import patch

from app.intake.agent import process_intake
from app.intake.schema import CaseSubmission, ChangeType


class _FakeConn:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _fake_get_connection():
    return _FakeConn()


@patch("app.intake.agent.insert_case")
@patch("app.intake.agent.next_case_sequence", return_value=1)
@patch("app.intake.agent.get_connection", side_effect=_fake_get_connection)
@patch(
    "app.intake.agent.classify_change_type",
    return_value=(ChangeType.NEW_PRODUCT, 0.92),
)
def test_complete_submission_is_validated(mock_classify, mock_conn, mock_seq, mock_insert):
    submission = CaseSubmission(
        product_type="Business checking",
        geography="Colorado",
        segment="Commercial",
        target_date="2026-11-01",
        description="Open accounts for licensed cannabis dispensaries in Colorado.",
    )
    result = process_intake(submission, documents=[])

    assert result.status.value == "validated"
    assert result.missing_fields == []
    assert result.change_type == ChangeType.NEW_PRODUCT
    assert result.case_id.startswith("FCRM-")


@patch("app.intake.agent.insert_case")
@patch("app.intake.agent.next_case_sequence", return_value=2)
@patch("app.intake.agent.get_connection", side_effect=_fake_get_connection)
def test_missing_fields_flagged_not_rejected(mock_conn, mock_seq, mock_insert):
    submission = CaseSubmission(product_type="Business checking")  # rest is missing
    result = process_intake(submission, documents=[])

    assert result.status.value == "needs_more_information"
    assert "geography" in result.missing_fields
    assert "description" in result.missing_fields
