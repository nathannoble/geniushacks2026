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
