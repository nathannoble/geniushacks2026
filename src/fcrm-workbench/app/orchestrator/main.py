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
from fastapi import FastAPI, Form, HTTPException, UploadFile, File, Request, Depends
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

# Loads .env from the current working directory (repo root) into os.environ.
load_dotenv()

from app.intake.schema import UploadedDocumentRef
from app.notifications import db as notifications_db
from app.orchestrator import db as orchestrator_db
from app.middleware.auth import require_auth
from app.orchestrator.service import (
    get_case_state,
    resolve_gate1,
    resolve_gate2,
    resubmit_case,
    start_case,
)

app = FastAPI(title="FCRM Workbench")

@app.middleware("http")
async def add_no_cache_for_ui(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/ui"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/ui/")


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
    request: Request,
    product_type: Optional[str] = Form(None),
    change_type: Optional[str] = Form(None),
    geography: Optional[str] = Form(None),
    segment: Optional[str] = Form(None),
    target_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    files: list[UploadFile] = File(default=[]),
    user = Depends(require_auth)
):
    """Runs the whole graph: intake -> extraction/retrieval -> screening ->
    scoring -> drafting -> Gate 1, in one blocking call. Supports both Form data
    and JSON payloads."""
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            data = await request.json()
            product_type = data.get("product_type") or product_type
            change_type = data.get("change_type") or change_type
            geography = data.get("geography") or geography
            segment = data.get("segment") or segment
            target_date = data.get("target_date") or target_date
            description = data.get("description") or description
        except Exception:
            pass

    submission = _submission_dict(product_type, change_type, geography, segment, target_date, description)
    documents = await _save_uploads(files)
    return await run_in_threadpool(start_case, submission, documents)


@app.post("/cases/{case_id}/resubmit")
async def resubmit(
    case_id: str,
    request: Request,
    product_type: Optional[str] = Form(None),
    change_type: Optional[str] = Form(None),
    geography: Optional[str] = Form(None),
    segment: Optional[str] = Form(None),
    target_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    files: list[UploadFile] = File(default=[]),
    user = Depends(require_auth)
):
    """The other half of the Gate 1 RFI loop — re-enters the same case_id's
    thread at intake with updated fields."""
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            data = await request.json()
            product_type = data.get("product_type") or product_type
            change_type = data.get("change_type") or change_type
            geography = data.get("geography") or geography
            segment = data.get("segment") or segment
            target_date = data.get("target_date") or target_date
            description = data.get("description") or description
        except Exception:
            pass

    submission = _submission_dict(product_type, change_type, geography, segment, target_date, description)
    documents = await _save_uploads(files)

    row = orchestrator_db.get_case_row(case_id)
    if row:
        if not documents and row.get("documents"):
            documents = row["documents"]
        if row.get("submission"):
            for k, v in row["submission"].items():
                if not submission.get(k) and v:
                    submission[k] = v

    try:
        return await run_in_threadpool(resubmit_case, case_id, submission, documents)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


class Gate1Decision(BaseModel):
    action: str  # "finalize" | "rfi"
    notes: str = ""
    actor: str = ""


@app.post("/cases/{case_id}/gate1")
async def gate1(case_id: str, decision: Gate1Decision, user = Depends(require_auth)):
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
async def gate2(case_id: str, decision: Gate2Decision, user = Depends(require_auth)):
    try:
        return await run_in_threadpool(
            resolve_gate2, case_id, decision.outcome, decision.conditions, decision.actor
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/cases")
def list_cases(user = Depends(require_auth)):
    """List recent cases for the Workbench Dashboard queue."""
    return orchestrator_db.list_cases(limit=100)


@app.get("/cases/{case_id}")
def get_case(case_id: str, user = Depends(require_auth)):
    row = orchestrator_db.get_case_row(case_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"No case {case_id}")
    return row


@app.get("/cases/{case_id}/state")
async def get_state(case_id: str, user = Depends(require_auth)):
    """Returns the full LangGraph state checkpoint for a case."""
    try:
        return await run_in_threadpool(get_case_state, case_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        row = orchestrator_db.get_case_row(case_id)
        if row:
            return {"case_id": case_id, "status": row.get("status"), "row": row}
        raise HTTPException(status_code=404, detail=f"No state available for {case_id}: {exc}")



@app.get("/cases/{case_id}/notifications")
def get_notifications(case_id: str, user = Depends(require_auth)):
    return notifications_db.list_notifications(case_id)


@app.get("/cases/{case_id}/sla")
def get_sla(case_id: str, user = Depends(require_auth)):
    status = notifications_db.get_sla_status(case_id)
    if status is None:
        raise HTTPException(status_code=404, detail=f"No case {case_id}")
    return status


@app.get("/analytics/summary")
def get_analytics(user = Depends(require_auth)):
    """Returns aggregated portfolio risk metrics, monthly summaries, and gate governance velocity."""
    return orchestrator_db.get_analytics_summary()



# Workbench UI static placeholder (app/ui/static) — mounted last so it never
# shadows the API routes above.
_samples_dir = Path("sample-files")
if _samples_dir.exists():
    app.mount("/sample-files", StaticFiles(directory=str(_samples_dir)), name="sample-files")

_ui_dir = Path("app/ui/static")
if _ui_dir.exists():
    app.mount("/ui", StaticFiles(directory=str(_ui_dir), html=True), name="ui")
