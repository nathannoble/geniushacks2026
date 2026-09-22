from app.eval.scorers import extraction_recall, retrieval_top1_correct, scoring_tier_correct
from app.extraction.schema import ExtractedFact


def _fact(value: str) -> ExtractedFact:
    return ExtractedFact(field="party", value=value, source_document="d.pdf", source_location="page 1")


def test_extraction_recall_all_found():
    facts = [_fact("Green Leaf Dispensary LLC"), _fact("Colorado")]
    assert extraction_recall(facts, ["green leaf", "colorado"]) == 1.0


def test_extraction_recall_partial():
    facts = [_fact("Green Leaf Dispensary LLC")]
    assert extraction_recall(facts, ["green leaf", "michigan"]) == 0.5


def test_extraction_recall_none_expected_is_trivially_perfect():
    assert extraction_recall([], []) == 1.0


def test_extraction_recall_is_case_insensitive_substring_match():
    facts = [_fact("MARCUS J. HOLLOWAY")]
    assert extraction_recall(facts, ["marcus j. holloway"]) == 1.0


def test_retrieval_top1_correct():
    assert retrieval_top1_correct("POL-100", "POL-100") is True
    assert retrieval_top1_correct("POL-045", "POL-100") is False
    assert retrieval_top1_correct(None, "POL-100") is False


def test_scoring_tier_correct():
    assert scoring_tier_correct("Critical", "Critical") is True
    assert scoring_tier_correct("High", "Critical") is False
