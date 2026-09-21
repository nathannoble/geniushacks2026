"""FastAPI entrypoint. Wires M1 (Intake & Validation) up as a single
multipart endpoint — JSON fields and uploaded documents together in one
POST /cases request. Later modules (M2–M9) will be added as further
routes/graph nodes without changing this file's shape.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Form, UploadFile, File
from fastapi.staticfiles import StaticFiles

# Loads .env from the current working directory (repo root) into os.environ.
# Without this, DATABASE_URL/ANTHROPIC_API_KEY are only set if you exported
# them manually in the shell before starting uvicorn.
load_dotenv()

from app.intake.agent import process_intake
from app.intake.schema import CaseSubmission, UploadedDocumentRef, ValidatedCase

app = FastAPI(title="FCRM Workbench")

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/cases", response_model=ValidatedCase)
async def create_case(
    product_type: Optional[str] = Form(None),
    change_type: Optional[str] = Form(None),
    geography: Optional[str] = Form(None),
    segment: Optional[str] = Form(None),
    target_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    files: list[UploadFile] = File(default=[]),
):
    submission = CaseSubmission(
        product_type=product_type,
        change_type=change_type,
        geography=geography,
        segment=segment,
        target_date=target_date or None,
        description=description,
    )

    documents: list[UploadedDocumentRef] = []
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
            )
        )

    return process_intake(submission, documents)


# Workbench UI static placeholder (app/ui/static) — mounted last so it never
# shadows the API routes above.
_ui_dir = Path("app/ui/static")
if _ui_dir.exists():
    app.mount("/ui", StaticFiles(directory=str(_ui_dir), html=True), name="ui")
