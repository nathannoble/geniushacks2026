"""M3 — text embeddings.

A dependency-free "hashing embedding": tokenize, hash each token into a
fixed-size vector, accumulate term frequency, L2-normalize. No API key, no
multi-GB model download — appropriate for this project's small (~5-document)
synthetic policy library.

This is cruder than a real semantic embedding model (no synonym/paraphrase
understanding — it's closer to bag-of-words than to Voyage/OpenAI-style
embeddings). If you later get Voyage API access, swap the body of `embed()`
for a Voyage call; every caller (agent.py, the seed script) only depends on
this function's signature, not its implementation.
"""
from __future__ import annotations

import hashlib
import math
import re

EMBEDDING_DIM = 256

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Function words carry almost no topical signal but, unfiltered, dilute
# content words like "cannabis" or "dispensaries" in a scheme with no IDF
# weighting — this is exactly what let a merely cannabis-adjacent document
# (a hemp precedent) out-rank the actual cannabis banking policy for a
# cannabis banking query.
_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
    "have", "if", "in", "into", "is", "it", "its", "of", "on", "or", "our",
    "that", "the", "their", "this", "to", "was", "were", "will", "with",
    "which", "who", "whom", "not", "no", "any", "all", "each", "may",
    "must", "shall", "should", "would", "can", "could",
}


def _tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS]


def embed(text: str) -> list[float]:
    vector = [0.0] * EMBEDDING_DIM
    for token in _tokenize(text):
        # Stable hash (not Python's salted hash()) so embeddings are
        # reproducible across processes and runs.
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % EMBEDDING_DIM
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign

    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]
