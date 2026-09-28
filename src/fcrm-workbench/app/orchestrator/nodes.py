"""M0 — node functions for the orchestrator graph.

Each node is a thin adapter: convert state dicts to a module's Pydantic
model, call that module's own agent function, convert the result back to
plain dicts for the state. The real logic always lives in the module's own
agent.py — nothing FCRM-specific is reimplemented here.

Every enrichment node guards on status == "validated" and no-ops otherwise,
so an incomplete intake short-circuits cleanly without extra conditional
edges cluttering the graph shape.
"""
from __future__ import annotations

from langgraph.types import interrupt

from app.drafting.agent import draft_assessment
from app.extraction.agent import extract_case_facts
from app.extraction.schema import ExtractedFact
from app.intake.agent import process_intake
from app.intake.schema import CaseSubmission, UploadedDocumentRef
from app.notifications.agent import notify
from app.retrieval.agent import retrieve_policy_citations
from app.retrieval.schema import PolicyCitation
from app.scoring.agent import compute_risk_score
from app.scoring.schema import RiskScore
from app.screening.agent import screen_parties
from app.screening.schema import ScreeningReport

from . import db as orchestrator_db
from .factor_mapping import map_facts_to_factor_scores
from .state import CaseGraphState


def intake_node(state: CaseGraphState) -> dict:
    submission = CaseSubmission(**state["submission"])
    documents = [UploadedDocumentRef(**d) for d in state.get("documents", [])]
    existing_case_id = state.get("case_id")

    validated = process_intake(submission, documents, existing_case_id=existing_case_id)

    if validated.status.value == "validated":
        notify(validated.case_id, "product_owner", "case_submitted")
    else:
        notify(
            validated.case_id,
            "product_owner",
            "needs_more_information",
            detail=", ".join(validated.missing_fields),
        )

    return {
        "case_id": validated.case_id,
        "status": validated.status.value,
        "change_type": validated.change_type.value if validated.change_type else None,
        "missing_fields": validated.missing_fields,
        "documents": [d.model_dump() for d in validated.documents],
        "submission": validated.submission.model_dump(mode="json"),
    }


def extraction_node(state: CaseGraphState) -> dict:
    if state.get("status") != "validated":
        return {}
    documents = [UploadedDocumentRef(**d) for d in state.get("documents", [])]
    result = extract_case_facts(state["case_id"], documents)
    return {"facts": [f.model_dump() for f in result.facts]}


def retrieval_node(state: CaseGraphState) -> dict:
    if state.get("status") != "validated":
        return {}
    submission = state.get("submission", {})
    query = " ".join(str(v) for v in submission.values() if v)
    citations = retrieve_policy_citations(query, top_k=5)
    return {"citations": [c.model_dump() for c in citations]}


def screening_node(state: CaseGraphState) -> dict:
    """Runs after extraction (not in parallel with it) — it screens the
    party names extraction actually found, per M4's documented input
    ("party/vendor/geography list from case facts")."""
    if state.get("status") != "validated":
        return {}
    facts = [ExtractedFact(**f) for f in state.get("facts", [])]
    parties = sorted({f.value for f in facts if f.field == "party"})
    report = screen_parties(state["case_id"], parties)
    return {"screening_report": report.model_dump()}


def scoring_node(state: CaseGraphState) -> dict:
    if state.get("status") != "validated":
        return {}
    facts = [ExtractedFact(**f) for f in state.get("facts", [])]
    screening = ScreeningReport(**state["screening_report"])
    factor_scores = map_facts_to_factor_scores(facts, screening, state.get("change_type"))
    has_hit = any(m.status == "hit" for m in screening.matches)
    score = compute_risk_score(state["case_id"], factor_scores, has_hit)
    orchestrator_db.update_case_risk(state["case_id"], score.tier, score.weighted_total)
    return {"factor_scores": factor_scores, "risk_score": score.model_dump()}


def drafting_node(state: CaseGraphState) -> dict:
    facts = [ExtractedFact(**f) for f in state.get("facts", [])]
    citations = [PolicyCitation(**c) for c in state.get("citations", [])]
    screening = ScreeningReport(**state["screening_report"])
    score = RiskScore(**state["risk_score"])

    memo = draft_assessment(state["case_id"], facts, citations, screening, score)
    return {"memo": memo.model_dump()}


def gate1_node(state: CaseGraphState) -> dict:
    """The first hard stop. The graph genuinely pauses here — the process
    doesn't need to stay alive; PostgresSaver has already checkpointed
    everything above, so this can resume hours or days later from a
    completely separate request."""
    orchestrator_db.update_case_status(state["case_id"], "awaiting_gate1")
    notify(state["case_id"], "analyst", "awaiting_gate1_review")
    decision = interrupt({"gate": "gate1", "case_id": state["case_id"], "memo": state["memo"]})
    orchestrator_db.record_gate_decision(state["case_id"], "gate1", decision)
    return {"gate1_decision": decision}


def rfi_exit_node(state: CaseGraphState) -> dict:
    notes = state.get("gate1_decision", {}).get("notes", "")
    orchestrator_db.update_case_status(state["case_id"], "needs_more_information")
    notify(state["case_id"], "product_owner", "needs_more_information", detail=notes)
    return {"status": "needs_more_information", "rfi_notes": notes}


def gate2_node(state: CaseGraphState) -> dict:
    """The second hard stop — the committee's recorded decision."""
    orchestrator_db.update_case_status(state["case_id"], "awaiting_gate2")
    notify(state["case_id"], "committee", "awaiting_gate2_review")
    decision = interrupt({"gate": "gate2", "case_id": state["case_id"], "memo": state["memo"]})
    orchestrator_db.record_gate_decision(state["case_id"], "gate2", decision)
    return {"gate2_decision": decision}


def closed_archived_node(state: CaseGraphState) -> dict:
    outcome = state["gate2_decision"]["outcome"]
    orchestrator_db.finalize_case(state["case_id"], outcome)
    notify(state["case_id"], "product_owner", "case_decided", detail=outcome)
    return {"status": "closed", "final_outcome": outcome}
