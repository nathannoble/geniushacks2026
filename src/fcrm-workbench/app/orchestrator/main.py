"""FastAPI entrypoint.

/cases (POST) now runs the full M0 graph via the orchestrator service layer
— intake through Gate 1 in one call — rather than just M1 in isolation.
Additional routes cover resubmission (the Gate 1 RFI loop) and resolving
each gate from a separate request, since a paused case can sit for days.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Form, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

# Loads .env from the current working directory (repo root) into os.environ.
load_dotenv()

from app.intake.schema import UploadedDocumentRef
from app.orchestrator import db as orchestrator_db
from app.orchestrator.service import resolve_gate1, resolve_gate2, resubmit_case, start_case

app = FastAPI(title="FCRM Workbench")

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/health")
def health():
    return {"status": "ok"}


async def _save_uploads(files: list[UploadFile]) -> list[dict]:
    documents = []
    for f in files:
        dest = UPLOAD_DIR / f"{uuid.uuid4()}_{f.filename}"
        contents = await f.read()
        dest.write_bytes(contents)
        documents.append(
            UploadedDocumentRef(
                filename=f.filename,
                content_type=f.content_type or "application/octet-stream",
                size_bytes=len(contents),
                storage_path=str(dest),
            ).model_dump(mode="json")
        )
    return documents


def _submission_dict(
    product_type, change_type, geography, segment, target_date, description
) -> dict:
    return {
        "product_type": product_type,
        "change_type": change_type,
        "geography": geography,
        "segment": segment,
        "target_date": target_date or None,
        "description": description,
    }


@app.post("/cases")
async def create_case(
    product_type: Optional[str] = Form(None),
    change_type: Optional[str] = Form(None),
    geography: Optional[str] = Form(None),
    segment: Optional[str] = Form(None),
    target_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    files: list[UploadFile] = File(default=[]),
):
    """Runs the whole graph: intake -> extraction/retrieval -> screening ->
    scoring -> drafting -> Gate 1, in one blocking call. For a case that
    validates, this response is the graph paused at Gate 1 with the draft
    memo attached (state["awaiting"] == ["gate1"]); for an incomplete
    submission, it's the needs_more_information result and nothing beyond
    intake ran."""
    submission = _submission_dict(product_type, change_type, geography, segment, target_date, description)
    documents = await _save_uploads(files)
    return await run_in_threadpool(start_case, submission, documents)


@app.post("/cases/{case_id}/resubmit")
async def resubmit(
    case_id: str,
    product_type: Optional[str] = Form(None),
    change_type: Optional[str] = Form(None),
    geography: Optional[str] = Form(None),
    segment: Optional[str] = Form(None),
    target_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    files: list[UploadFile] = File(default=[]),
):
    """The other half of the Gate 1 RFI loop — re-enters the same case_id's
    thread at intake with updated fields."""
    submission = _submission_dict(product_type, change_type, geography, segment, target_date, description)
    documents = await _save_uploads(files)
    try:
        return await run_in_threadpool(resubmit_case, case_id, submission, documents)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


class Gate1Decision(BaseModel):
    action: str  # "finalize" | "rfi"
    notes: str = ""
    actor: str = ""


@app.post("/cases/{case_id}/gate1")
async def gate1(case_id: str, decision: Gate1Decision):
    try:
        return await run_in_threadpool(
            resolve_gate1, case_id, decision.action, decision.notes, decision.actor
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


class Gate2Decision(BaseModel):
    outcome: str  # "Approved" | "Rejected" | "Deferred" | "Approved with Conditions"
    conditions: list[str] = []
    actor: str = ""


@app.post("/cases/{case_id}/gate2")
async def gate2(case_id: str, decision: Gate2Decision):
    try:
        return await run_in_threadpool(
            resolve_gate2, case_id, decision.outcome, decision.conditions, decision.actor
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/cases/{case_id}")
def get_case(case_id: str):
    row = orchestrator_db.get_case_row(case_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"No case {case_id}")
    return row


# Workbench UI static placeholder (app/ui/static) — mounted last so it never
# shadows the API routes above.
_ui_dir = Path("app/ui/static")
if _ui_dir.exists():
    app.mount("/ui", StaticFiles(directory=str(_ui_dir), html=True), name="ui")
