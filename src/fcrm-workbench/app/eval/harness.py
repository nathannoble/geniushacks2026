"""M8 — golden-case regression harness.

Runs the real M2/M3/M5 modules (not mocked) against each golden case and
scores the output against what's expected. This is what scripts/run_eval.py
runs as the CI regression job on every change.

M6 (drafting) isn't scored here — a "faithfulness" metric for free-text
synthesis is exactly the kind of thing Ragas/DeepEval's LLM-judge metrics
are built for, and is a documented gap in this first pass (see scorers.py).
"""
from __future__ import annotations

import json
from pathlib import Path

from app.extraction.agent import extract_case_facts
from app.intake.schema import UploadedDocumentRef
from app.retrieval.agent import retrieve_policy_citations
from app.scoring.agent import compute_risk_score

from .schema import CaseEvalResult, EvalReport, GoldenCase
from .scorers import extraction_recall, retrieval_top1_correct, scoring_tier_correct

GOLDEN_CASES_DIR = Path(__file__).resolve().parent.parent.parent / "eval" / "golden_cases"

# Below this, a golden case fails even if nothing else is wrong with it.
EXTRACTION_RECALL_THRESHOLD = 0.8


def load_golden_cases() -> list[GoldenCase]:
    cases = []
    for path in sorted(GOLDEN_CASES_DIR.glob("*.json")):
        cases.append(GoldenCase(**json.loads(path.read_text())))
    return cases


def run_case(case: GoldenCase) -> CaseEvalResult:
    notes: list[str] = []
    extraction_score = None
    retrieval_correct = None
    scoring_correct = None
    passed = True

    if case.document_path:
        doc = UploadedDocumentRef(
            filename=Path(case.document_path).name,
            content_type="application/pdf",
            size_bytes=0,
            storage_path=case.document_path,
        )
        result = extract_case_facts(case.name, [doc])
        extraction_score = extraction_recall(result.facts, case.expected_facts)
        if extraction_score < EXTRACTION_RECALL_THRESHOLD:
            passed = False
            notes.append(f"extraction recall {extraction_score:.2f} below {EXTRACTION_RECALL_THRESHOLD} threshold")

    if case.expected_top_policy_id:
        query = " ".join(str(v) for v in case.submission.values() if v) or case.description
        citations = retrieve_policy_citations(query, top_k=1)
        top_id = citations[0].policy_id if citations else None
        retrieval_correct = retrieval_top1_correct(top_id, case.expected_top_policy_id)
        if not retrieval_correct:
            passed = False
            notes.append(f"top-1 retrieval was {top_id!r}, expected {case.expected_top_policy_id!r}")

    if case.factor_scores is not None and case.expected_tier:
        score = compute_risk_score(case.name, case.factor_scores, case.has_unresolved_screening_hit)
        scoring_correct = scoring_tier_correct(score.tier, case.expected_tier)
        if not scoring_correct:
            passed = False
            notes.append(f"scored tier {score.tier!r}, expected {case.expected_tier!r}")

    return CaseEvalResult(
        name=case.name,
        extraction_recall=extraction_score,
        retrieval_top1_correct=retrieval_correct,
        scoring_tier_correct=scoring_correct,
        passed=passed,
        notes=notes,
    )


def run_all() -> EvalReport:
    cases = load_golden_cases()
    results = [run_case(c) for c in cases]
    pass_rate = sum(1 for r in results if r.passed) / len(results) if results else 1.0
    return EvalReport(results=results, pass_rate=pass_rate)
