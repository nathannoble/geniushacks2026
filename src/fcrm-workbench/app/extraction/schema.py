from __future__ import annotations

from pydantic import BaseModel


class ExtractedFact(BaseModel):
    field: str  # "party" | "jurisdiction" | "customer_type" | "transaction_type"
    value: str
    source_document: str  # filename
    source_location: str  # "page 3" (PDF/image) or "para 12" (docx)


class ExtractionResult(BaseModel):
    case_id: str
    facts: list[ExtractedFact]
