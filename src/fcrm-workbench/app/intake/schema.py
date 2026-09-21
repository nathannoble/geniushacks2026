"""M1 — Intake & Validation: data shapes.

CaseSubmission is the raw form as the Product Owner submits it.
ValidatedCase is what M1 returns — always returned, even when fields are
missing, per the accepted architecture (Gate 1's RFI loop routes back here).
"""
from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ChangeType(str, Enum):
    NEW_PRODUCT = "new_product"
    NEW_GEOGRAPHY = "new_geography"
    NEW_CUSTOMER_SEGMENT = "new_customer_segment"
    PRODUCT_MODIFICATION = "product_modification"
    VENDOR_RELATIONSHIP = "vendor_relationship"
    POLICY_CHANGE = "policy_change"
    OTHER = "other"


class CaseStatus(str, Enum):
    VALIDATED = "validated"
    NEEDS_MORE_INFORMATION = "needs_more_information"


# Fields the Product Owner form must supply. "change_type" is deliberately
# excluded — it's derived by the classifier from `description`, not typed in
# directly, though the submitter may still supply a hint.
REQUIRED_FIELDS = ["product_type", "geography", "segment", "target_date", "description"]


class CaseSubmission(BaseModel):
    product_type: Optional[str] = None
    change_type: Optional[str] = None  # free-text hint; classifier normalizes it
    geography: Optional[str] = None
    segment: Optional[str] = None
    target_date: Optional[date] = None
    description: Optional[str] = None  # free text describing the change


class UploadedDocumentRef(BaseModel):
    filename: str
    content_type: str
    size_bytes: int
    storage_path: str


class ValidatedCase(BaseModel):
    case_id: str
    status: CaseStatus
    change_type: Optional[ChangeType] = None
    change_type_confidence: Optional[float] = None
    missing_fields: list[str] = Field(default_factory=list)
    submission: CaseSubmission
    documents: list[UploadedDocumentRef] = Field(default_factory=list)
