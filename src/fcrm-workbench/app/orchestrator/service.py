"""M0 — service layer.

The actual entry points the FastAPI routes call. Each function opens a
fresh checkpointer connection for the duration of one graph call — the
connection doesn't need to stay open between a gate pausing and someone
resolving it later, since PostgresSaver has already persisted everything.
"""
from __future__ import annotations

import uuid

from langgraph.types import Command

from . import db as orchestrator_db
from .graph import get_checkpointer, get_compiled_graph


def _snapshot_to_dict(state) -> dict:
    values = dict(state.values)
    values["awaiting"] = list(state.next) if state.next else []
    return values


def start_case(submission: dict, documents: list[dict]) -> dict:
    thread_id = str(uuid.uuid4())
    with get_checkpointer() as checkpointer:
        graph = get_compiled_graph(checkpointer)
        config = {"configurable": {"thread_id": thread_id}}
        graph.invoke({"submission": submission, "documents": documents}, config)
        state = graph.get_state(config)

    case_id = state.values["case_id"]
    orchestrator_db.set_thread_id(case_id, thread_id)
    return _snapshot_to_dict(state)


def resubmit_case(case_id: str, submission: dict, documents: list[dict]) -> dict:
    """The Gate 1 RFI loop's other half — re-enters the same thread at
    intake with updated fields, which then flows through the whole graph
    again (fresh extraction/retrieval/screening/scoring/drafting) up to
    Gate 1 once more."""
    thread_id = orchestrator_db.get_thread_id(case_id)
    with get_checkpointer() as checkpointer:
        graph = get_compiled_graph(checkpointer)
        config = {"configurable": {"thread_id": thread_id}}
        graph.invoke({"case_id": case_id, "submission": submission, "documents": documents}, config)
        state = graph.get_state(config)
    return _snapshot_to_dict(state)


def resolve_gate1(case_id: str, action: str, notes: str = "", actor: str = "") -> dict:
    """action: 'finalize' | 'rfi'"""
    thread_id = orchestrator_db.get_thread_id(case_id)
    with get_checkpointer() as checkpointer:
        graph = get_compiled_graph(checkpointer)
        config = {"configurable": {"thread_id": thread_id}}
        graph.invoke(Command(resume={"action": action, "notes": notes, "actor": actor}), config)
        state = graph.get_state(config)
    return _snapshot_to_dict(state)


def resolve_gate2(case_id: str, outcome: str, conditions: list[str] | None = None, actor: str = "") -> dict:
    """outcome: 'Approved' | 'Rejected' | 'Deferred' | 'Approved with Conditions'"""
    thread_id = orchestrator_db.get_thread_id(case_id)
    with get_checkpointer() as checkpointer:
        graph = get_compiled_graph(checkpointer)
        config = {"configurable": {"thread_id": thread_id}}
        graph.invoke(
            Command(resume={"outcome": outcome, "conditions": conditions or [], "actor": actor}), config
        )
        state = graph.get_state(config)
    return _snapshot_to_dict(state)


def get_case_state(case_id: str) -> dict:
    """Returns the full LangGraph checkpoint state (facts, citations, screening,
    risk score, draft memo, gate decisions) for a case."""
    thread_id = orchestrator_db.get_thread_id(case_id)
    with get_checkpointer() as checkpointer:
        graph = get_compiled_graph(checkpointer)
        config = {"configurable": {"thread_id": thread_id}}
        state = graph.get_state(config)
    return _snapshot_to_dict(state)

