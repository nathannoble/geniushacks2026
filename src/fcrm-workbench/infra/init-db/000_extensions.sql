-- Runs before every other file in this directory (docker-entrypoint-initdb.d
-- executes files in alphabetical order on first container boot). Required
-- before 002_enrichment_schema.sql, which creates a column of type VECTOR.
CREATE EXTENSION IF NOT EXISTS vector;
