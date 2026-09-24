CREATE EXTENSION IF NOT EXISTS vector;

-- Case Database: system of record for every case (M1, M9, orchestrator, Workbench UI)

CREATE TABLE IF NOT EXISTS case_id_sequences (
    year        INT PRIMARY KEY,
    last_value  INT NOT NULL
);

CREATE TABLE IF NOT EXISTS cases (
    case_id                 TEXT PRIMARY KEY,
    status                  TEXT NOT NULL,
    change_type             TEXT,
    change_type_confidence  REAL,
    missing_fields          JSONB NOT NULL DEFAULT '[]',
    submission               JSONB NOT NULL,
    documents                JSONB NOT NULL DEFAULT '[]',
    risk_tier               TEXT,
    risk_score              REAL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (status);
