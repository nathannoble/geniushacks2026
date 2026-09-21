from app.extraction.agent import _facts_from_model_response


def test_parses_valid_json_array():
    raw = (
        '[{"field": "party", "value": "Green Leaf Dispensary LLC", "source_location": "page 1"},'
        '{"field": "jurisdiction", "value": "Colorado", "source_location": "page 1"}]'
    )
    facts = _facts_from_model_response(raw, "spec.pdf")

    assert len(facts) == 2
    assert facts[0].field == "party"
    assert facts[0].value == "Green Leaf Dispensary LLC"
    assert facts[0].source_document == "spec.pdf"
    assert facts[1].source_location == "page 1"


def test_empty_array_returns_no_facts():
    assert _facts_from_model_response("[]", "spec.pdf") == []


def test_malformed_json_returns_no_facts_instead_of_raising():
    assert _facts_from_model_response("not json", "spec.pdf") == []


def test_markdown_fenced_json_is_still_parsed():
    raw = (
        '```json\n'
        '[{"field": "jurisdiction", "value": "Colorado", "source_location": "page 1"}]\n'
        '```'
    )
    facts = _facts_from_model_response(raw, "spec.pdf")

    assert len(facts) == 1
    assert facts[0].value == "Colorado"


def test_items_missing_required_keys_are_skipped_not_raised():
    raw = '[{"field": "party"}, {"field": "jurisdiction", "value": "Michigan"}]'
    facts = _facts_from_model_response(raw, "spec.pdf")

    assert len(facts) == 1
    assert facts[0].value == "Michigan"
