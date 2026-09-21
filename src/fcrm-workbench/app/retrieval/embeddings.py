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


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


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
