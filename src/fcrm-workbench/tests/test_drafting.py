from unittest.mock import MagicMock, patch

from app.drafting.agent import draft_assessment
from app.extraction.schema import ExtractedFact
from app.retrieval.schema import PolicyCitation
from app.scoring.schema import RiskScore
from app.screening.schema import ScreeningMatch, ScreeningReport


def _sample_inputs():
    facts = [
        ExtractedFact(
            field="party", value="Green Leaf Dispensary LLC",
            source_document="sample.pdf", source_location="page 1",
        ),
    ]
    citations = [
        PolicyCitation(policy_id="POL-100", title="Cannabis-Related Business Banking Policy",
                        excerpt="CRB accounts are rated no lower than Medium risk.", similarity=0.87),
    ]
    screening = ScreeningReport(
        case_id="T-1",
        matches=[
            ScreeningMatch(party_name="Marcus J. Holloway", status="hit",
                            matched_entry="Marcus J. Holloway", match_type="exact", confidence=1.0),
        ],
    )
    score = RiskScore(case_id="T-1", tier="High", weighted_total=2.4, factors=[],
                       rationale="Driven mainly by cash intensity and an unresolved screening hit.")
    return facts, citations, screening, score


def _mock_response(json_text: str) -> MagicMock:
    response = MagicMock()
    response.content = [MagicMock(text=json_text)]
    return response


@patch("app.drafting.agent._get_client")
def test_citations_are_built_from_inputs_not_the_model(mock_get_client):
    mock_get_client.return_value.messages.create.return_value = _mock_response(
        '{"summary": "Test summary.", "open_questions": [], "suggested_conditions": []}'
    )
    facts, citations, screening, score = _sample_inputs()

    memo = draft_assessment("T-1", facts, citations, screening, score)

    sources = [c.source for c in memo.citations]
    assert any("M2 extraction" in s for s in sources)
    assert any("M3 policy: POL-100" in s for s in sources)
    assert any("M4 screening: Marcus J. Holloway" in s for s in sources)
    assert memo.risk_tier == "High"  # from risk_score, never from the model


@patch("app.drafting.agent._get_client")
def test_no_hit_screening_matches_are_not_cited(mock_get_client):
    mock_get_client.return_value.messages.create.return_value = _mock_response(
        '{"summary": "s", "open_questions": [], "suggested_conditions": []}'
    )
    facts, citations, screening, score = _sample_inputs()
    screening.matches.append(
        ScreeningMatch(party_name="Sarah Kim", status="no_hit", matched_entry=None, confidence=1.0)
    )

    memo = draft_assessment("T-1", facts, citations, screening, score)

    assert not any("Sarah Kim" in c.source for c in memo.citations)


@patch("app.drafting.agent._get_client")
def test_fenced_json_response_still_parses(mock_get_client):
    mock_get_client.return_value.messages.create.return_value = _mock_response(
        '```json\n{"summary": "Fenced summary.", "open_questions": ["Q1"], '
        '"suggested_conditions": ["C1"]}\n```'
    )
    facts, citations, screening, score = _sample_inputs()

    memo = draft_assessment("T-1", facts, citations, screening, score)

    assert memo.summary == "Fenced summary."
    assert memo.open_questions == ["Q1"]
    assert memo.suggested_conditions == ["C1"]


@patch("app.drafting.agent._get_client")
def test_unparseable_model_response_falls_back_gracefully(mock_get_client):
    mock_get_client.return_value.messages.create.return_value = _mock_response("not json at all")
    facts, citations, screening, score = _sample_inputs()

    memo = draft_assessment("T-1", facts, citations, screening, score)

    assert "unavailable" in memo.summary.lower()
    assert memo.open_questions == []
    # Citations are still built correctly even though the model call failed to parse.
    assert len(memo.citations) >= 3
