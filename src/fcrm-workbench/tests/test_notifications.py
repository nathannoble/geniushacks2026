import datetime as dt
from unittest.mock import patch

from app.notifications.db import compute_sla
from app.notifications.templates import render


def test_render_fills_known_template():
    message = render("case_submitted", "FCRM-2026-0001")
    assert message == "Case FCRM-2026-0001 has been submitted and is now under FCRM review."


def test_render_includes_detail_when_template_uses_it():
    message = render("case_decided", "FCRM-2026-0001", detail="Approved with Conditions")
    assert "Approved with Conditions" in message


def test_render_falls_back_for_unknown_event_type():
    message = render("some_future_event", "FCRM-2026-0001")
    assert "FCRM-2026-0001" in message
    assert "some_future_event" in message


def test_sla_not_breached_within_target():
    created_at = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    now = created_at + dt.timedelta(hours=10)  # well under the 48h target
    result = compute_sla("FCRM-2026-0001", "validated", created_at, now=now)

    assert result["breached"] is False
    assert result["elapsed_hours"] == 10.0
    assert result["target_hours"] == 48


def test_sla_breached_past_target_while_open():
    created_at = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    now = created_at + dt.timedelta(hours=60)  # past the 48h target
    result = compute_sla("FCRM-2026-0001", "validated", created_at, now=now)

    assert result["breached"] is True


def test_sla_not_breached_once_closed_even_if_late():
    created_at = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    now = created_at + dt.timedelta(hours=60)
    result = compute_sla("FCRM-2026-0001", "closed", created_at, now=now)

    assert result["breached"] is False  # a closed case can't breach after the fact


@patch("app.notifications.agent.db.insert_notification")
def test_notify_logs_and_writes_when_no_webhook_configured(mock_insert):
    from app.notifications.agent import notify

    notify("FCRM-2026-0001", "analyst", "awaiting_gate1_review")

    mock_insert.assert_called_once()
    args = mock_insert.call_args.args
    assert args[0] == "FCRM-2026-0001"
    assert args[1] == "analyst"
    assert args[2] == "awaiting_gate1_review"
    assert args[4] == "log"  # channel, since WEBHOOK_URL isn't set in tests
