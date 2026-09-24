# FCRM Workbench

Financial Crimes Risk Management (FCRM) workbench for multi-agent compliance evaluation, deterministic scorecard computation, and committee governance.

---

## Quick Start with Docker

For complete instructions, please refer to [DOCKER_GUIDE.md](file:///Users/kris/Projects/geniushacks2026/src/fcrm-workbench/DOCKER_GUIDE.md).

### 1. Launch Services
```bash
docker compose up -d
```

### 2. First-Time Setup (Database Initialization)
```bash
# Set up LangGraph persistent checkpointer
docker compose exec app python3 scripts/setup_checkpointer.py

# Seed compliance policies into pgvector
docker compose exec app python3 scripts/seed_policy_library.py
```

### 3. Open the Workbench
- **UI**: [http://localhost:8000/ui/](http://localhost:8000/ui/)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Langfuse Tracing**: [http://localhost:3001](http://localhost:3001)

---

## Architecture Overview

- **M0 — Orchestrator**: LangGraph StateGraph with persistent PostgreSQL checkpointer (`PostgresSaver`).
- **M1 — Intake**: Fast validation and Claude Haiku change-type classification.
- **M2 — Extraction**: Multimodal document parsing with Claude 3.5 Sonnet (PDF, DOCX, images).
- **M3 — Policy Retrieval**: Vector similarity search over compliance rules using `pgvector` and TF-IDF.
- **M4 — Screening**: Hybrid entity screening (exact, fuzzy string matching with `rapidfuzz`, and Claude Haiku triage).
- **M5 — Risk Scoring**: Mathematical scorecard (5 factors) with mandatory floor rules + Claude Haiku executive rationale.
- **M6 — Drafting**: Structured assessment memo generation with Claude 3.5 Sonnet.
- **M7 / M8 — Gate 1 & 2 Governance**: Human-in-the-loop analyst and committee approval checkpoints.
- **M9 — Notifications & Audit**: Audit logging and event notifications.
