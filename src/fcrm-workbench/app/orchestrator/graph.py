"""M0 — Orchestrator.

Wires M1-M9 into one LangGraph StateGraph. Gate 1 and Gate 2 use
langgraph.types.interrupt(), backed by a PostgresSaver checkpointer, so a
paused case survives a process restart and resumes from a completely
separate request — no in-memory state to lose.

Graph shape:
    START -> intake -> (validated?) -> extraction -> [retrieval, screening] (parallel)
    retrieval, screening -> scoring (fan-in) -> drafting -> gate1
    gate1 -> (finalize?) -> gate2 -> closed_archived -> END
    gate1 -> (rfi?) -> rfi_exit -> END
An invalid intake (missing fields) skips straight from intake to END; the
product owner resubmits later via the same thread_id (see service.py).

Note on the fan-out shape: retrieval doesn't actually need extraction's
output (it only uses the raw submission text), so it could in principle run
in parallel with extraction rather than after it. It's wired to run after
extraction instead because LangGraph's fan-in only reliably waits for a
node's *direct* predecessors to finish in the same superstep — screening
depends on extraction's facts, so it necessarily completes one superstep
later than a true extraction-parallel retrieval would, and having scoring
depend on both extraction (superstep N) and screening (superstep N+1)
caused scoring to fire before screening's write to state landed. Keeping
extraction, retrieval, and screening at uniform depth avoids that race.
"""
from __future__ import annotations

import os

from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph

from . import nodes
from .state import CaseGraphState


def _route_after_intake(state: CaseGraphState):
    if state.get("status") == "validated":
        return "extraction"
    return END


def _route_after_gate1(state: CaseGraphState):
    decision = state.get("gate1_decision") or {}
    if decision.get("action") == "rfi":
        return "rfi_exit"
    return "gate2"


def build_graph() -> StateGraph:
    graph = StateGraph(CaseGraphState)

    graph.add_node("intake", nodes.intake_node)
    graph.add_node("extraction", nodes.extraction_node)
    graph.add_node("retrieval", nodes.retrieval_node)
    graph.add_node("screening", nodes.screening_node)
    graph.add_node("scoring", nodes.scoring_node)
    graph.add_node("drafting", nodes.drafting_node)
    graph.add_node("gate1", nodes.gate1_node)
    graph.add_node("rfi_exit", nodes.rfi_exit_node)
    graph.add_node("gate2", nodes.gate2_node)
    graph.add_node("closed_archived", nodes.closed_archived_node)

    graph.add_edge(START, "intake")
    graph.add_conditional_edges("intake", _route_after_intake)

    graph.add_edge("extraction", "retrieval")
    graph.add_edge("extraction", "screening")

    graph.add_edge("retrieval", "scoring")
    graph.add_edge("screening", "scoring")

    graph.add_edge("scoring", "drafting")
    graph.add_edge("drafting", "gate1")

    graph.add_conditional_edges("gate1", _route_after_gate1)
    graph.add_edge("rfi_exit", END)

    graph.add_edge("gate2", "closed_archived")
    graph.add_edge("closed_archived", END)

    return graph


def get_checkpointer():
    """A context manager — open with `with get_checkpointer() as cp:` for
    the duration of a single graph.invoke() call. Call .setup() once before
    first use (see scripts/setup_checkpointer.py)."""
    return PostgresSaver.from_conn_string(os.environ["DATABASE_URL"])


def get_compiled_graph(checkpointer):
    return build_graph().compile(checkpointer=checkpointer)
