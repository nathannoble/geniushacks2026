"""M3 — text embeddings: a TF-IDF-weighted hashing embedding.

Tokenize, filter stopwords, weight each token by its corpus IDF (rare,
distinctive terms count more; terms common across the whole policy library
count less), hash into a fixed-size vector, L2-normalize. Still zero API
keys and zero heavy model downloads — but this now handles the two real
failure modes plain term-frequency hashing hit in practice: function words
diluting content-word signal (fixed by stopword filtering), and a short
chunk with one exact phrase match outscoring a longer, more genuinely
relevant document (fixed by IDF, which discounts a term based on how many
chunks it appears in — not just how many times it appears in one chunk).

IDF weights are computed once from the whole policy corpus (compute_idf(),
called by scripts/seed_policy_library.py) and persisted via
app.retrieval.idf_store, so a query embedded later uses the exact same
weights the corpus chunks were embedded with.
"""
from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from typing import Optional

EMBEDDING_DIM = 256

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Function words carry almost no topical signal — filtered before either TF
# or IDF ever sees them.
_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
    "have", "if", "in", "into", "is", "it", "its", "of", "on", "or", "our",
    "that", "the", "their", "this", "to", "was", "were", "will", "with",
    "which", "who", "whom", "not", "no", "any", "all", "each", "may",
    "must", "shall", "should", "would", "can", "could",
}

# Applied to any token the corpus IDF has never seen (e.g. a query term the
# policy library never uses) — a neutral, middling weight rather than 0.
_DEFAULT_IDF = 1.0


def _tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS]


def compute_idf(documents: list[str]) -> dict[str, float]:
    """Standard smoothed IDF: idf(t) = ln((1 + N) / (1 + df(t))) + 1 — always
    positive, and a term appearing in every document still gets a small
    positive weight rather than zeroing out entirely."""
    n_docs = len(documents)
    doc_freq: Counter[str] = Counter()
    for doc in documents:
        for token in set(_tokenize(doc)):
            doc_freq[token] += 1

    return {token: math.log((1 + n_docs) / (1 + df)) + 1.0 for token, df in doc_freq.items()}


def embed(text: str, idf: Optional[dict[str, float]] = None) -> list[float]:
    idf = idf or {}
    counts = Counter(_tokenize(text))
    vector = [0.0] * EMBEDDING_DIM

    for token, tf in counts.items():
        weight = tf * idf.get(token, _DEFAULT_IDF)
        # Stable hash (not Python's salted hash()) so embeddings are
        # reproducible across processes and runs.
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % EMBEDDING_DIM
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign * weight

    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]
