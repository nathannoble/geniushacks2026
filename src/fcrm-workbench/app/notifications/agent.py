"""M9 — Case & Notification Service.

notify() is the single entry point M0's nodes call at each state
transition. It renders a templated message, writes it to the notification
log (the system of record the Workbench UI and audit trail both read), and
— if WEBHOOK_URL is configured — POSTs it there too. With no webhook
configured, it just logs, which is enough for the synthetic hackathon scope.

This is a direct-call implementation, not a pub/sub event bus: M0's nodes
call notify() inline rather than publishing events M9 subscribes to. That's
a deliberate simplification for a single-process demo; a production
evolution would decouple this behind a real queue.
"""
from __future__ import annotations

import os

from . import db
from .templates import render
from .email import send_notification_email

WEBHOOK_URL = os.environ.get("WEBHOOK_URL")


def notify(case_id: str, persona: str, event_type: str, detail: str = "") -> None:
    message = render(event_type, case_id, detail)
    channel = "log"

    if event_type in ["awaiting_gate1_review", "awaiting_gate2_review"]:
        send_notification_email(event_type, case_id, detail)

    if WEBHOOK_URL:
        try:
            import httpx

            httpx.post(
                WEBHOOK_URL,
                json={"case_id": case_id, "persona": persona, "event_type": event_type, "message": message},
                timeout=5,
            )
            channel = "webhook"
        except Exception as exc:
            print(f"[notifications] webhook delivery failed, falling back to log: {exc}")

    print(f"[notify:{persona}] {message}")
    db.insert_notification(case_id, persona, event_type, message, channel)
