-- M3 retrieval: corpus-wide IDF weights, computed once from the whole
-- policy library at seed time and reused for every query embedding.

CREATE TABLE IF NOT EXISTS policy_idf (
    term  TEXT PRIMARY KEY,
    idf   REAL NOT NULL
);
