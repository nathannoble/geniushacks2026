-- M0 orchestrator support: maps a case to its LangGraph thread, records the
-- final committee outcome, and the append-only Gate 1/Gate 2 audit log.

ALTER TABLE cases ADD COLUMN IF NOT EXISTS thread_id TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS final_outcome TEXT;

CREATE TABLE IF NOT EXISTS approvals (
    id          SERIAL PRIMARY KEY,
    case_id     TEXT NOT NULL REFERENCES cases(case_id),
    gate        TEXT NOT NULL,       -- 'gate1' | 'gate2'
    actor       TEXT,
    decision    JSONB NOT NULL,       -- the raw resume payload, verbatim
    decided_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approvals_case_id ON approvals (case_id);
