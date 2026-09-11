# Genius Hacks Q3 2026 — Strategy & Plan
Risk Assessment Workbench Challenge

## Challenge Summary
Source: https://myridius.com/genius-hacks-q3-2026

Myridius's Q3 2026 internal AI hackathon. Challenge: design an automated platform that helps a large national bank evaluate new products, features, and organizational changes for financial-crime regulatory compliance — replacing a manual email/spreadsheet process that currently takes 15–20 business days, targeting ~2 days. Synthetic data only; no real system connections. Risk scoring must follow published supervisory frameworks. Human review gates are mandatory — nothing self-approves.

**Registration deadline:** September 2, 2026 (passed)
**Submission deadline:** September 30, 2026
**Today:** September 11, 2026 — 19 days remaining

### Required deliverables
1. GitHub repo: application code, AI prompts, docs, architecture diagrams, governance frameworks, evaluation definitions, tests, deployment specs.
2. Presentation deck: problem spec, system architecture, AI/human decision boundaries, evaluation results, demo.

### Six delivery stages AI must be demonstrated across
Requirements, Design, Development, Testing, Deployment, Operations.

### Judging weights
- AI harness & agent orchestration — 30%
- SDLC automation — 20%
- Human-in-the-loop governance — 15%
- Evaluation framework — 10%
- Requirement expansion — 10%
- Production readiness — 5%
- Token efficiency — 5%
- Engineering judgment — 5%

**Key insight:** orchestration + SDLC automation + governance = 65% of the score. This is a hackathon about *how* the system was built with AI, not primarily about banking-domain completeness.

### Suggested (optional) stack
Models: Claude, OpenAI, Gemini, Azure AI Foundry, AWS Bedrock
Orchestration: LangGraph, CrewAI, AutoGen, Semantic Kernel, Temporal
Coding tools: Claude Code, GitHub Copilot, Cursor, Windsurf
Data/retrieval: pgvector, Pinecone, Weaviate, Elasticsearch
Evaluation: Langfuse, LangSmith, Ragas, DeepEval
Deployment: Docker, Kubernetes, Azure Container Apps, AWS ECS
**Prohibited:** prompt-to-app generators (Lovable, Bolt, v0, Replit Agent)

## Two Candidate Approaches

**A — Deep multi-agent orchestration.** Real agent graph (LangGraph/CrewAI): intake/requirements agent, risk-scoring agent grounded in supervisory frameworks via RAG, governance agent enforcing human review gates, eval/observability agent. Narrow business scope; orchestration and decision boundaries are the product.

**B — Broad SDLC coverage, simple core.** Modest agent setup (2–3 agents), heavy visible AI usage across all six stages (AI-drafted requirements, architecture, tests, deployment specs, monitoring). Simple system; the AI-native process paper trail is the product.

**Recommendation: Approach A**, executed with B's discipline — 4–6 well-defined agents (not a sprawling mesh), a real human-in-the-loop gate, and a genuine eval harness (Ragas/DeepEval + Langfuse/LangSmith traces). This directly maximizes the 45% of the score tied to orchestration + governance, and a well-built agent graph naturally produces the requirement-expansion and decision-boundary documentation Approach B chases anyway. Watch scope: token efficiency and engineering judgment are explicit rubric lines that punish over-building.

## SDLC Sequence
1. **Requirement expansion** (days 1–2): AI-assisted expansion of the brief into a real spec — risk inputs, supervisory scoring methodology, what "human review gate" means operationally. Documented, not a README paragraph (10% of score).
2. **Design** (days 2–5): agent architecture, synthetic data model, AI/human decision-boundary diagram, governance framework, eval framework design.
3. **Development** (days 5–17): agent graph, RAG over regulatory framework docs, scoring logic, workflow automation with approval gates, thin workbench UI.
4. **Testing/evaluation** (days 12–22, overlapping): unit/integration tests, agent-level evals against known supervisory examples, adversarial/gate-bypass edge cases (doubles as governance evidence).
5. **Deployment** (days 18–24): containerize (Docker default), deployment spec, basic CI.
6. **Operations** (days 20–26, overlapping): observability/monitoring, logging, documented continuous-improvement loop.
7. **Packaging & rehearsal** (days 24–29): repo cleanup, final diagrams/governance docs, deck build, demo rehearsal.

## Team Split (4 equal-skill developers)
All four co-author requirements/design in week 1, then split into end-to-end workstream ownership (not narrow specialization), reconverging for integration and rehearsal.

- **Dev 1 — Agent orchestration & AI harness.** Agent graph, model integration, prompt design, human-in-the-loop gate logic. Highest-weighted single piece of the rubric.
- **Dev 2 — Domain, data & retrieval.** Synthetic data generation, supervisory risk-scoring methodology research, RAG layer. Drives the requirement-expansion doc.
- **Dev 3 — Application, integration & deployment.** Workbench UI/API tying agents together, containerization, CI, deployment specs.
- **Dev 4 — Evaluation, governance & observability.** Test suite, eval harness, monitoring, governance-framework docs, architecture diagrams, deck coordination — de facto submission owner.

## Timeline Estimate
19 calendar days remain (Sept 11 → Sept 30), ~14 weekdays. At 2–4 hrs/day × 4 people (~12 person-hrs/day average) → roughly 160–200 effective person-hours. Enough for a focused MVP of Approach A; thin margin for full polish if scope creeps or start is delayed.

Suggested milestones:
- **Sept 24–25:** feature-complete core (agents + UI + gates working end to end)
- **Sept 28:** evaluation, observability, governance docs solid
- **Sept 29:** full dry-run rehearsal
- **Sept 30:** submit (thin buffer)

Main risk is scope, not skill — a smaller, cleanly-governed agent system with real evals beats a feature-heavy one that isn't fully wired.
