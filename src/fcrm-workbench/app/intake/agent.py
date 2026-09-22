"""M1 — Intake & Validation.

Validates the Product Owner's submission, assigns a case ID, classifies the
change type, and flags incomplete fields. Per the accepted architecture,
this module never hard-rejects an incomplete submission: a case with
missing fields is still created and marked needs_more_information, which is
what lets Gate 1 route an RFI back through this same entry point later.
"""
from __future__ import annotations

import datetime as dt

from typing import Optional

from .classifier import classify_change_type
from .db import get_connection, insert_case, next_case_sequence, update_case_intake
from .schema import (
    REQUIRED_FIELDS,
    CaseStatus,
    CaseSubmission,
    UploadedDocumentRef,
    ValidatedCase,
)

# Below this, treat the classification itself as an incomplete field rather
# than trusting a low-confidence guess.
CONFIDENCE_THRESHOLD = 0.6


def _missing_fields(submission: CaseSubmission) -> list[str]:
    data = submission.model_dump()
    return [f for f in REQUIRED_FIELDS if not data.get(f)]


def _generate_case_id(conn) -> str:
    year = dt.date.today().year
    seq = next_case_sequence(conn, year)
    return f"FCRM-{year}-{seq:04d}"


def process_intake(
    submission: CaseSubmission,
    documents: list[UploadedDocumentRef],
    existing_case_id: Optional[str] = None,
) -> ValidatedCase:
    """existing_case_id set means this is a resubmission (the Gate 1 RFI
    loop) — the existing case row is updated in place rather than minting a
    new case_id, so the same case_id carries through the whole lifecycle."""
    missing = _missing_fields(submission)

    change_type = None
    confidence = None
    if submission.description:
        change_type, confidence = classify_change_type(
            submission.description, submission.change_type
        )
        if confidence < CONFIDENCE_THRESHOLD and "change_type" not in missing:
            missing.append("change_type")

    status = (
        CaseStatus.NEEDS_MORE_INFORMATION if missing else CaseStatus.VALIDATED
    )

    with get_connection() as conn:
        if existing_case_id:
            case_id = existing_case_id
            update_case_intake(
                conn,
                case_id=case_id,
                status=status.value,
                change_type=change_type.value if change_type else None,
                change_type_confidence=confidence,
                missing_fields=missing,
                submission=submission.model_dump(mode="json"),
                documents=[d.model_dump() for d in documents],
            )
        else:
            case_id = _generate_case_id(conn)
            insert_case(
                conn,
                case_id=case_id,
                status=status.value,
                change_type=change_type.value if change_type else None,
                change_type_confidence=confidence,
                missing_fields=missing,
                submission=submission.model_dump(mode="json"),
                documents=[d.model_dump() for d in documents],
            )

    return ValidatedCase(
        case_id=case_id,
        status=status,
        change_type=change_type,
        change_type_confidence=confidence,
        missing_fields=missing,
        submission=submission,
        documents=documents,
    )
