-- Synthetic Policy Library (M3) + case columns for M2/M3/M4 outputs

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS policy_chunks (
    id          SERIAL PRIMARY KEY,
    policy_id   TEXT NOT NULL,
    title       TEXT NOT NULL,
    chunk_text  TEXT NOT NULL,
    embedding   VECTOR(256) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_chunks_embedding
    ON policy_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- M2 (facts), M3 (citations), M4 (screening) each write their output onto
-- the case row for now, ahead of M0's orchestrator tying them together.
ALTER TABLE cases ADD COLUMN IF NOT EXISTS facts JSONB;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS citations JSONB;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS screening_report JSONB;
