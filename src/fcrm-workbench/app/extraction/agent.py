"""M2 — Document Extraction.

Parses uploaded product specs, vendor contracts, marketing copy, and process
diagrams into normalized case facts, each tagged with the document and
location it came from so M6's memo can cite it.

PDFs and images go straight to Claude's native document/image understanding.
DOCX files are extracted to plain text with python-docx first, since the
Messages API doesn't accept .docx as a document block directly; paragraph
numbers stand in for page numbers as the source_location for those.
"""
from __future__ import annotations

import base64
import os
from pathlib import Path

import docx
from anthropic import Anthropic

from app.common.json_utils import parse_json_safely

from .schema import ExtractedFact, ExtractionResult

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


_MODEL = "claude-sonnet-5"

_SYSTEM_PROMPT = (
    "You extract structured facts from FCRM (Financial Crimes Risk Management) case "
    "documents for a bank. Extract every instance of: parties (people/companies named), "
    "jurisdictions (countries/states/regions), customer_types (e.g. retail, commercial, "
    "cannabis dispensary), and transaction_types (e.g. cash deposits, wire transfers).\n"
    'Respond ONLY with a JSON array: [{"field": "party"|"jurisdiction"|"customer_type"|'
    '"transaction_type", "value": "...", "source_location": "page 3" or similar}]. '
    "If nothing relevant is found, respond with []."
)


def _facts_from_model_response(text: str, filename: str) -> list[ExtractedFact]:
    parsed = parse_json_safely(text, default=[])
    if not isinstance(parsed, list):
        return []

    facts: list[ExtractedFact] = []
    for item in parsed:
        try:
            facts.append(
                ExtractedFact(
                    field=item["field"],
                    value=item["value"],
                    source_document=filename,
                    source_location=item.get("source_location", "unknown"),
                )
            )
        except (KeyError, TypeError):
            continue
    return facts


def _extract_from_pdf(path: Path, filename: str) -> list[ExtractedFact]:
    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    response = _get_client().messages.create(
        model=_MODEL,
        max_tokens=2000,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {"type": "base64", "media_type": "application/pdf", "data": data},
                    },
                    {"type": "text", "text": "Extract the case facts from this document."},
                ],
            }
        ],
    )
    return _facts_from_model_response(response.content[0].text, filename)


def _extract_from_image(path: Path, filename: str, media_type: str) -> list[ExtractedFact]:
    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    response = _get_client().messages.create(
        model=_MODEL,
        max_tokens=2000,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}},
                    {"type": "text", "text": "Extract the case facts from this image."},
                ],
            }
        ],
    )
    return _facts_from_model_response(response.content[0].text, filename)


def _extract_from_docx(path: Path, filename: str) -> list[ExtractedFact]:
    document = docx.Document(str(path))
    paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
    numbered = "\n".join(f"[para {i}] {text}" for i, text in enumerate(paragraphs, start=1))

    response = _get_client().messages.create(
        model=_MODEL,
        max_tokens=2000,
        system=_SYSTEM_PROMPT
        + ' Documents are Word files with no page numbers — use "para N" (matching the '
        '[para N] markers) as source_location.',
        messages=[{"role": "user", "content": f"Extract the case facts from this document:\n\n{numbered}"}],
    )
    return _facts_from_model_response(response.content[0].text, filename)


_DOCX_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def extract_case_facts(case_id: str, documents: list) -> ExtractionResult:
    """documents: a list of objects with storage_path, content_type, and
    filename attributes — app.intake.schema.UploadedDocumentRef satisfies
    this, so M1's output plugs straight in."""
    facts: list[ExtractedFact] = []
    for doc in documents:
        path = Path(doc.storage_path)
        if doc.content_type == "application/pdf":
            facts.extend(_extract_from_pdf(path, doc.filename))
        elif doc.content_type.startswith("image/"):
            facts.extend(_extract_from_image(path, doc.filename, doc.content_type))
        elif doc.content_type in _DOCX_MIME_TYPES:
            facts.extend(_extract_from_docx(path, doc.filename))
        # Unsupported types are silently skipped for now; once M2 wires into
        # the orchestrator, consider flagging these as needs-more-information.

    return ExtractionResult(case_id=case_id, facts=facts)
