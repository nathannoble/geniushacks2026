import math

from app.retrieval.embeddings import EMBEDDING_DIM, compute_idf, embed


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


# A representative slice of the real policy library (infra/policy-library/),
# used below to compute realistic corpus IDF stats rather than a toy
# 2-3-document corpus that would make the regression test tautological.
_MINI_CORPUS = {
    "POL-100_opening": (
        "This policy governs the bank's approach to opening and maintaining deposit accounts "
        "for cannabis-related businesses (CRBs), including licensed dispensaries, cultivators, "
        "processors, and ancillary vendors, in states where cannabis is legal under state law."
    ),
    "POL-100_federal_conflict": (
        "Cannabis remains a Schedule I controlled substance under the federal Controlled "
        "Substances Act, regardless of state legalization. Because the bank is federally "
        "regulated, any CRB relationship must be evaluated under enhanced due diligence."
    ),
    "POL-045_purpose": (
        "Defines the weighted factors used to rate a customer or product change as Low, "
        "Medium, High, or Critical risk when cash intensity is a material factor, as it is "
        "for cannabis-related businesses, check-cashing services, and other cash-heavy "
        "customer types."
    ),
    "POL-045_cash_scoring": (
        "Cash percentage of total deposits is scored: under 20% scores 0, 20-40% scores 1, "
        "40-60% scores 2, 60-80% scores 3, and above 80% scores 4. Cannabis dispensaries "
        "typically score 3 or 4 on this factor given limited access to card processing."
    ),
    "POL-010_purpose": (
        "Establishes the required Financial Crimes Risk Management (FCRM) review process "
        "before Commercial Banking, Retail Banking, or any other business line launches a "
        "new product, enters a new geography, or begins serving a new customer segment."
    ),
    "PREC-2025-014_summary": (
        "In a prior case, Commercial Banking requested approval to bank a state-licensed hemp "
        "processing facility in Oregon. Hemp is federally legal under the 2018 Farm Bill when "
        "THC content stays below 0.3%, distinguishing this case from cannabis dispensary "
        "banking, though FCRM applied similar enhanced due diligence given the adjacent "
        "industry and historical cash intensity."
    ),
    "PREC-2025-014_outcome": (
        "The case was rated Medium risk. Cash represented 45% of deposits, jurisdiction risk "
        "was Low (single-state operation in a state with an established regulatory program), "
        "and screening returned no hits on any named owner or beneficial owner."
    ),
}


def test_tfidf_fixes_both_known_retrieval_failures():
    """Regression test for two real failures the golden-case eval (M8)
    caught in sequence:
    1. Unweighted term frequency let PREC-2025-014 (a hemp precedent that
       mentions "cannabis" only in passing) out-rank POL-100 (the actual
       cannabis banking policy) — fixed by stopword filtering.
    2. Stopword filtering alone then let POL-045's short "cash scoring"
       paragraph (one exact phrase match, "cannabis dispensaries") out-rank
       POL-100's longer, more genuinely relevant opening paragraph — this is
       what IDF weighting fixes, by discounting a term based on how many
       chunks across the corpus contain it, not just how many times it
       appears in one chunk.
    This test computes IDF from a representative multi-document corpus (not
    just the two/three previously-competing chunks) so the result isn't
    tautological, then confirms POL-100's opening paragraph now outranks
    both previous false winners for the cannabis-banking query."""
    idf = compute_idf(list(_MINI_CORPUS.values()))

    query = embed("Open accounts for licensed cannabis dispensaries in Colorado and Michigan", idf=idf)
    pol_100 = embed(_MINI_CORPUS["POL-100_opening"], idf=idf)
    pol_045 = embed(_MINI_CORPUS["POL-045_cash_scoring"], idf=idf)
    prec = embed(_MINI_CORPUS["PREC-2025-014_summary"], idf=idf)

    def cosine(a, b):
        return sum(x * y for x, y in zip(a, b))

    score_pol_100 = cosine(query, pol_100)
    score_pol_045 = cosine(query, pol_045)
    score_prec = cosine(query, prec)

    assert score_pol_100 > score_prec, "regression: precedent case out-ranking the actual policy again"
    assert score_pol_100 > score_pol_045, "regression: short exact-phrase chunk out-ranking the actual policy again"


def test_compute_idf_gives_higher_weight_to_rarer_terms():
    idf = compute_idf(list(_MINI_CORPUS.values()))
    # "cannabis" appears in most of the mini-corpus; "dispensaries" is rarer.
    assert idf["dispensaries"] > idf["cannabis"]
