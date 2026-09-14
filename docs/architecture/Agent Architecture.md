# FCRM Agent Blueprint — Option A Architecture
Ten buildable modules for the Risk Assessment Workbench

Visual diagram (persisted artifact): https://claude.ai/artifact/5JTDYJ1pZM6m8jpjyBScid

## Scope decisions (confirmed)
- **Intake:** structured form + document uploads (product specs, vendor contracts, marketing copy, process diagrams)
- **Policy grounding:** synthetic FCRM policy library, authored in-house (stays within the hackathon's synthetic-data-only rule)
- **Screening:** included — simulated sanctions/PEP/adverse-media/vendor-risk checks against synthetic reference data
- **Committee decision:** a single recorded decision by the chair/analyst (not in-app multi-member voting)

## Case lifecycle (8 states)
Draft → Submitted → Enrichment → Draft Assessment → **Gate 1: Analyst Review** → Committee Review → **Gate 2: Decision Recorded** (Approved / Rejected / Deferred / Approved with Conditions) → Closed & Archived.
Gate 1 can send a case back to Draft/Submitted as an RFI (request for information) to the product owner.

## Modules

| ID | Module | Owner | Purpose | Tools |
|---|---|---|---|---|
| M0 | Orchestrator | Dev 1 | Sequences every module call, holds both gates open until a human acts, manages the RFI loop | LangGraph (StateGraph, interrupt()/resume); Temporal as fallback |
| M1 | Intake & Validation | Dev 3 | Validates the form, assigns case ID, classifies change type, flags incomplete submissions | Pydantic/Zod, Claude Haiku (taxonomy normalization), Postgres |
| M2 | Document Extraction | Dev 2 | Parses uploaded docs into normalized case facts with source-page citations | Claude (document understanding), LlamaParse, unstructured.io |
| M3 | Policy & Regulatory Retrieval | Dev 2 | Retrieves the specific policy sections/precedents that apply to this case | pgvector/Weaviate, Voyage embeddings, Cohere rerank |
| M4 | Screening | Dev 2 + Dev 3 | Simulated sanctions/PEP/adverse-media/vendor-risk checks, triages fuzzy matches | Mock REST service + synthetic watchlists, Claude Haiku (triage only) |
| M5 | Risk Scoring | Dev 1 | Deterministic weighted scorecard risk tier (Low/Med/High/Critical); LLM explains, never invents, the score | Versioned Python scorecard, Claude (rationale) |
| M6 | Draft Assessment | Dev 1 | Synthesizes M2–M5 into the memo the analyst reviews, with inline citations | Claude (long-context), versioned memo template |
| M7 | Human Review Gates | Dev 1 + Dev 3 | The two hard stops — nothing advances without a recorded human action; every action hits the audit log | LangGraph interrupt(), approvals table |
| M8 | Eval & Observability Harness | Dev 4 | Regression-tests every module against a golden-case set; traces every run | Ragas/DeepEval, Langfuse, CI regression job |
| M9 | Case & Notification Service | Dev 3 | SLA clock (target 2 days vs. 15–20 today), persona notifications, system of record | Postgres, templated email/webhook stub |

## Data stores
- **Case Database** (Postgres) — every case, its state, its approvals
- **Synthetic Policy Library** (pgvector/Weaviate) — authored policy corpus for M3
- **Synthetic Screening Reference Data** — mock sanctions/PEP/adverse-media/vendor-risk records for M4
- **Audit Log** (append-only) — every AI output + human decision, keyed by case ID

## Note on the developer split
This refines (not contradicts) the Program Schedule's team assignments: intake and case/notification plumbing move to **Dev 3** alongside the Workbench UI, since they're thin and UI-adjacent, while **Dev 1** concentrates on the orchestrator, scorecard, and drafting agent — the reasoning-heavy core that carries the highest judging weight (agent orchestration, 30%).