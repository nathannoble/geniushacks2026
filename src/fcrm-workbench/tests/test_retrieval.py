import math

from app.retrieval.embeddings import EMBEDDING_DIM, embed


def test_embed_returns_unit_vector_of_expected_dimension():
    vector = embed("cannabis dispensary banking Colorado")

    assert len(vector) == EMBEDDING_DIM
    norm = math.sqrt(sum(v * v for v in vector))
    assert math.isclose(norm, 1.0, abs_tol=1e-6)


def test_embed_is_deterministic():
    text = "cash-intensive customer risk rating"
    assert embed(text) == embed(text)


def test_similar_text_scores_higher_than_unrelated_text():
    query = embed("cannabis dispensary banking risk")
    similar = embed("cannabis dispensary banking policy")
    unrelated = embed("quarterly software licensing renewal")

    def cosine(a, b):
        return sum(x * y for x, y in zip(a, b))

    assert cosine(query, similar) > cosine(query, unrelated)


def test_on_topic_policy_outranks_a_merely_adjacent_precedent():
    """Regression test for the exact failure the golden-case eval (M8)
    caught: PREC-2025-014 (a hemp precedent that mentions "cannabis" in
    passing) was out-ranking POL-100 (the actual cannabis banking policy)
    for a cannabis-banking query, because unfiltered stopwords diluted the
    content-word signal. This encodes that specific case as a regression
    test so a future embedding change can't silently reintroduce it."""
    query = embed("Open accounts for licensed cannabis dispensaries in Colorado and Michigan")

    pol_100_chunk = embed(
        "This policy governs the bank's approach to opening and maintaining deposit accounts "
        "for cannabis-related businesses (CRBs), including licensed dispensaries, cultivators, "
        "processors, and ancillary vendors, in states where cannabis is legal under state law."
    )
    prec_2025_014_chunk = embed(
        "In a prior case, Commercial Banking requested approval to bank a state-licensed hemp "
        "processing facility in Oregon. Hemp is federally legal under the 2018 Farm Bill when "
        "THC content stays below 0.3%, distinguishing this case from cannabis dispensary "
        "banking, though FCRM applied similar enhanced due diligence given the adjacent "
        "industry and historical cash intensity."
    )

    def cosine(a, b):
        return sum(x * y for x, y in zip(a, b))

    assert cosine(query, pol_100_chunk) > cosine(query, prec_2025_014_chunk)
