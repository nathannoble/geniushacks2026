# Running FCRM Workbench with Docker

Comprehensive step-by-step guide to run, initialize, and manage the **FCRM Workbench** multi-agent application stack using Docker.

---

## 1. Prerequisites

1. **Docker Desktop** installed on your machine (macOS, Linux, or Windows).
2. **Anthropic API Key** with access to Claude 3.5 Sonnet and Claude Haiku.

Make sure Docker Desktop is launched and running:
```bash
open -a Docker
```
*(Wait until the Docker whale icon in the menu bar is steady before running commands.)*

---

## 2. Environment Configuration (`.env`)

Ensure a `.env` file exists in `src/fcrm-workbench/.env` with your credentials:

```bash
# Claude LLM API Key (required for M1 intake, M2 extraction, M4 triage, M5 rationale, M6 drafting)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Database credentials
POSTGRES_PASSWORD=ghax2026
DATABASE_URL=postgresql://fcrm:ghax2026@db:5432/fcrm_workbench

# Langfuse Observability credentials
LANGFUSE_SECRET=8hKuy9QkmmzGquOI5VejnGlr+h5cm
LANGFUSE_SALT=Njj54apynmPhBSxIWwHbW
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
```

> **Note:** `.env` is listed in `.gitignore` and must never be committed to source control.

---

## 3. Starting the Services

From the workbench directory:

```bash
cd src/fcrm-workbench
docker compose up -d
```

### Services Started:
- **`fcrm-db`**: PostgreSQL 16 with `pgvector` extension and 25 seeded synthetic watchlist entries.
- **`fcrm-app`**: FastAPI server running Uvicorn on port `8000`, containing all AI agents and LangGraph orchestrator.
- **`fcrm-langfuse`**: Langfuse v2 tracing & metrics UI on port `3001`.

---

## 4. One-Time Initialization (Fresh Database Setup)

If you are starting with a fresh database or need to re-seed compliance policies, run these two commands inside the running container:

```bash
# 1. Create LangGraph persistent checkpoint tables in PostgreSQL
docker compose exec app python3 scripts/setup_checkpointer.py

# 2. Seed the compliance policy library into pgvector (POL-010, POL-045, POL-100, PREC-2025-014)
docker compose exec app python3 scripts/seed_policy_library.py
```

---

## 5. Application Access Endpoints

Once running, access the services in your browser:

| Component | URL | Description |
| :--- | :--- | :--- |
| **Workbench Web UI** | **[http://localhost:8000/ui/](http://localhost:8000/ui/)** | Compliance dossier review, queue filters, and Gate 1/2 approvals |
| **API Documentation** | **[http://localhost:8000/docs](http://localhost:8000/docs)** | Interactive Swagger / OpenAPI documentation |
| **Langfuse Dashboard** | **[http://localhost:3001](http://localhost:3001)** | Agent execution traces, token latency, and cost telemetry |
| **PostgreSQL Database** | `localhost:5432` | DB: `fcrm_workbench` \| User: `fcrm` \| Pass: `ghax2026` |

---

## 6. Testing with Sample Cases

Sample banking change request PDFs ready for upload are located in `sample-files/`:

- `003_cross_border_remittance_high_risk.pdf` *(Triggers sanctions hit on Meridian Overseas Holdings Ltd → High Tier)*
- `004_crypto_asset_custody_medium_risk.pdf` *(High product novelty, 0% cash, clean screening → Medium Tier)*
- `005_commercial_fleet_card_low_risk.pdf` *(Domestic US, established product, low risk → Low Tier)*
- `006_pep_private_wealth_onboarding_high_risk.pdf` *(Triggers PEP hit on Amara Chukwuemeka Obi → High Tier)*
- `007_incomplete_vendor_payment_portal_rfi.pdf` *(Missing target date → triggers Gate 1 RFI loop)*

You can drag-and-drop any of these PDFs directly into the UI at **http://localhost:8000/ui/** or submit via `curl`:

```bash
curl -X POST http://localhost:8000/cases \
  -F "product_type=Cross-Border Remittance" \
  -F "change_type=New Geography" \
  -F "geography=LATAM / UAE" \
  -F "segment=Consumer & MSB" \
  -F "target_date=2026-11-15" \
  -F "description=Cross-border remittance corridor expansion to new geography LATAM and UAE for high volume MSBs." \
  -F "files=@sample-files/003_cross_border_remittance_high_risk.pdf"
```

---

## 7. Common Lifecycle Commands

### View Live Logs:
```bash
# Stream app logs
docker compose logs -f app

# Stream database logs
docker compose logs -f db
```

### Stop Services (preserve database data):
```bash
docker compose stop
```

### Restart Services:
```bash
docker compose start
```

### Full Teardown (remove containers and network):
```bash
docker compose down
```

### Full Teardown (including database volume):
```bash
docker compose down -v
```

### Rebuild After Code or Dependency Changes:
```bash
docker compose build
docker compose up -d
```
