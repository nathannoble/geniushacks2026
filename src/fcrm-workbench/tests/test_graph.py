from unittest.mock import patch

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from app.drafting.schema import DraftMemo
from app.extraction.schema import ExtractedFact, ExtractionResult
from app.intake.schema import CaseStatus, CaseSubmission, ChangeType, ValidatedCase
from app.orchestrator.graph import build_graph
from app.retrieval.schema import PolicyCitation
from app.scoring.schema import RiskScore
from app.screening.schema import ScreeningMatch, ScreeningReport


def _compiled_graph():
    return build_graph().compile(checkpointer=InMemorySaver())


def _base_submission():
    return {
        "product_type": "Business checking",
        "geography": "Colorado",
        "segment": "Commercial",
        "target_date": "2026-11-01",
        "description": "Open accounts for licensed cannabis dispensaries in Colorado.",
    }


def _mock_validated_case(case_id="FCRM-2026-0001"):
    return ValidatedCase(
        case_id=case_id,
        status=CaseStatus.VALIDATED,
        change_type=ChangeType.NEW_PRODUCT,
        change_type_confidence=0.9,
        missing_fields=[],
        submission=CaseSubmission(**_base_submission()),
        documents=[],
    )


def _mock_needs_info_case(case_id="FCRM-2026-0002"):
    return ValidatedCase(
        case_id=case_id,
        status=CaseStatus.NEEDS_MORE_INFORMATION,
        change_type=None,
        change_type_confidence=None,
        missing_fields=["geography"],
        submission=CaseSubmission(product_type="Business checking"),
        documents=[],
    )


@patch("app.orchestrator.nodes.orchestrator_db.finalize_case")
@patch("app.orchestrator.nodes.orchestrator_db.record_gate_decision")
@patch("app.orchestrator.nodes.draft_assessment")
@patch("app.orchestrator.nodes.compute_risk_score")
@patch("app.orchestrator.nodes.screen_parties")
@patch("app.orchestrator.nodes.retrieve_policy_citations")
@patch("app.orchestrator.nodes.extract_case_facts")
@patch("app.orchestrator.nodes.process_intake")
def test_happy_path_reaches_gate1_then_gate2_then_closes(
    mock_intake, mock_extract, mock_retrieve, mock_screen, mock_score, mock_draft,
    mock_record, mock_finalize,
):
    mock_intake.return_value = _mock_validated_case()
    mock_extract.return_value = ExtractionResult(
        case_id="FCRM-2026-0001",
        facts=[ExtractedFact(field="party", value="Green Leaf Dispensary LLC",
                              source_document="spec.pdf", source_location="page 1")],
    )
    mock_retrieve.return_value = [
        PolicyCitation(policy_id="POL-100", title="Cannabis Banking Policy", excerpt="...", similarity=0.9)
    ]
    mock_screen.return_value = ScreeningReport(
        case_id="FCRM-2026-0001",
        matches=[ScreeningMatch(party_name="Green Leaf Dispensary LLC", status="no_hit", confidence=1.0)],
    )
    mock_score.return_value = RiskScore(
        case_id="FCRM-2026-0001", tier="Medium", weighted_total=1.5, factors=[], rationale="test"
    )
    mock_draft.return_value = DraftMemo(
        case_id="FCRM-2026-0001", risk_tier="Medium", summary="Test memo summary."
    )

    graph = _compiled_graph()
    config = {"configurable": {"thread_id": "test-thread-1"}}

    graph.invoke({"submission": _base_submission(), "documents": []}, config)
    state = graph.get_state(config)

    assert state.next == ("gate1",)
    assert state.values["case_id"] == "FCRM-2026-0001"
    assert state.values["memo"]["summary"] == "Test memo summary."
    mock_extract.assert_called_once()
    mock_retrieve.assert_called_once()
    mock_screen.assert_called_once()
    mock_score.assert_called_once()
    mock_draft.assert_called_once()

    graph.invoke(Command(resume={"action": "finalize", "notes": "", "actor": "analyst1"}), config)
    state = graph.get_state(config)
    assert state.next == ("gate2",)
    mock_record.assert_any_call(
        "FCRM-2026-0001", "gate1", {"action": "finalize", "notes": "", "actor": "analyst1"}
    )

    graph.invoke(
        Command(resume={"outcome": "Approved with Conditions", "conditions": ["Quarterly attestations"], "actor": "chair1"}),
        config,
    )
    state = graph.get_state(config)
    assert state.next == ()
    assert state.values["status"] == "closed"
    assert state.values["final_outcome"] == "Approved with Conditions"
    mock_finalize.assert_called_once_with("FCRM-2026-0001", "Approved with Conditions")


@patch("app.orchestrator.nodes.orchestrator_db.record_gate_decision")
@patch("app.orchestrator.nodes.draft_assessment")
@patch("app.orchestrator.nodes.compute_risk_score")
@patch("app.orchestrator.nodes.screen_parties")
@patch("app.orchestrator.nodes.retrieve_policy_citations")
@patch("app.orchestrator.nodes.extract_case_facts")
@patch("app.orchestrator.nodes.process_intake")
def test_gate1_rfi_ends_run_without_reaching_gate2(
    mock_intake, mock_extract, mock_retrieve, mock_screen, mock_score, mock_draft, mock_record,
):
    mock_intake.return_value = _mock_validated_case(case_id="FCRM-2026-0003")
    mock_extract.return_value = ExtractionResult(case_id="FCRM-2026-0003", facts=[])
    mock_retrieve.return_value = []
    mock_screen.return_value = ScreeningReport(case_id="FCRM-2026-0003", matches=[])
    mock_score.return_value = RiskScore(case_id="FCRM-2026-0003", tier="Low", weighted_total=0.0, factors=[])
    mock_draft.return_value = DraftMemo(case_id="FCRM-2026-0003", risk_tier="Low", summary="s")

    graph = _compiled_graph()
    config = {"configurable": {"thread_id": "test-thread-2"}}
    graph.invoke({"submission": _base_submission(), "documents": []}, config)

    graph.invoke(Command(resume={"action": "rfi", "notes": "Need more docs", "actor": "analyst2"}), config)
    state = graph.get_state(config)

    assert state.next == ()
    assert state.values["status"] == "needs_more_information"
    assert state.values["rfi_notes"] == "Need more docs"


@patch("app.orchestrator.nodes.extract_case_facts")
@patch("app.orchestrator.nodes.process_intake")
def test_incomplete_intake_skips_straight_to_end(mock_intake, mock_extract):
    mock_intake.return_value = _mock_needs_info_case()

    graph = _compiled_graph()
    config = {"configurable": {"thread_id": "test-thread-3"}}
    graph.invoke({"submission": {"product_type": "Business checking"}, "documents": []}, config)
    state = graph.get_state(config)

    assert state.next == ()
    assert state.values["status"] == "needs_more_information"
    mock_extract.assert_not_called()
