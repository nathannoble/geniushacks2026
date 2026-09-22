from unittest.mock import patch

from app.eval.harness import run_case
from app.eval.schema import GoldenCase
from app.extraction.schema import ExtractedFact, ExtractionResult
from app.retrieval.schema import PolicyCitation


@patch("app.eval.harness.extract_case_facts")
def test_case_fails_when_extraction_recall_below_threshold(mock_extract):
    mock_extract.return_value = ExtractionResult(
        case_id="t", facts=[ExtractedFact(field="party", value="Unrelated Corp",
                                           source_document="d.pdf", source_location="page 1")]
    )
    case = GoldenCase(
        name="t1", description="d",
        document_path="some/file.pdf",
        expected_facts=["Green Leaf Dispensary LLC", "Colorado", "Michigan"],
    )

    result = run_case(case)

    assert result.passed is False
    assert result.extraction_recall < 0.8
    assert any("extraction recall" in n for n in result.notes)


@patch("app.eval.harness.extract_case_facts")
def test_case_passes_when_extraction_recall_meets_threshold(mock_extract):
    mock_extract.return_value = ExtractionResult(
        case_id="t",
        facts=[
            ExtractedFact(field="party", value="Green Leaf Dispensary LLC", source_document="d.pdf", source_location="page 1"),
            ExtractedFact(field="jurisdiction", value="Colorado", source_document="d.pdf", source_location="page 1"),
        ],
    )
    case = GoldenCase(
        name="t2", description="d",
        document_path="some/file.pdf",
        expected_facts=["Green Leaf Dispensary LLC", "Colorado"],
    )

    result = run_case(case)

    assert result.passed is True
    assert result.extraction_recall == 1.0


@patch("app.eval.harness.retrieve_policy_citations")
def test_case_fails_on_wrong_top1_retrieval(mock_retrieve):
    mock_retrieve.return_value = [PolicyCitation(policy_id="POL-045", title="t", excerpt="e", similarity=0.5)]
    case = GoldenCase(name="t3", description="d", expected_top_policy_id="POL-100")

    result = run_case(case)

    assert result.passed is False
    assert result.retrieval_top1_correct is False


def test_case_fails_on_wrong_scoring_tier():
    case = GoldenCase(
        name="t4", description="d",
        factor_scores={"cash_percentage": 0, "jurisdiction_risk": 0, "screening_hit_severity": 0,
                       "product_novelty": 0, "prior_exam_findings": 0},
        has_unresolved_screening_hit=False,
        expected_tier="Critical",  # actual will be Low given all-zero factors
    )

    result = run_case(case)

    assert result.passed is False
    assert result.scoring_tier_correct is False


def test_case_with_no_assertions_trivially_passes():
    case = GoldenCase(name="t5", description="d — no document, no retrieval, no scoring checks")
    result = run_case(case)
    assert result.passed is True
