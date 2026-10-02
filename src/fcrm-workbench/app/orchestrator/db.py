"""M0 — persistence.

Plain psycopg2, consistent with the other modules. Three responsibilities:
mapping a case_id to its LangGraph thread_id (so a later gate decision can
find the right paused graph), the append-only approvals audit log every
Gate 1/Gate 2 action lands in, and recording the final case outcome.
"""
from __future__ import annotations

import os
from typing import Optional

import psycopg2
import psycopg2.extras


def _connect():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def set_thread_id(case_id: str, thread_id: str) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE cases SET thread_id = %s WHERE case_id = %s", (thread_id, case_id))
        conn.commit()
    finally:
        conn.close()


def get_thread_id(case_id: str) -> str:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT thread_id FROM cases WHERE case_id = %s", (case_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    if not row or not row[0]:
        raise ValueError(f"No thread_id on record for case {case_id}")
    return row[0]


def record_gate_decision(case_id: str, gate: str, decision: dict) -> None:
    """Every Gate 1/Gate 2 action lands here with actor and timestamp,
    regardless of outcome — this table is the audit trail."""
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO approvals (case_id, gate, actor, decision) VALUES (%s, %s, %s, %s)",
                (case_id, gate, decision.get("actor"), psycopg2.extras.Json(decision)),
            )
        conn.commit()
    finally:
        conn.close()


def finalize_case(case_id: str, outcome: str) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE cases SET status = 'closed', final_outcome = %s WHERE case_id = %s",
                (outcome, case_id),
            )
        conn.commit()
    finally:
        conn.close()


def get_case_row(case_id: str) -> Optional[dict]:
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM cases WHERE case_id = %s", (case_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    return dict(row) if row else None


def update_case_risk(case_id: str, risk_tier: str, risk_score: float) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE cases SET risk_tier = %s, risk_score = %s WHERE case_id = %s",
                (risk_tier, risk_score, case_id),
            )
        conn.commit()
    finally:
        conn.close()

def update_case_status(case_id: str, status: str) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE cases SET status = %s WHERE case_id = %s",
                (status, case_id),
            )
        conn.commit()
    finally:
        conn.close()


def list_cases(limit: int = 50) -> list[dict]:
    try:
        conn = _connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT case_id, status, change_type, change_type_confidence, missing_fields, "
                    "submission, documents, thread_id, final_outcome, risk_tier, risk_score, created_at, updated_at "
                    "FROM cases ORDER BY created_at DESC LIMIT %s",
                    (limit,),
                )
                rows = cur.fetchall()
                return [dict(r) for r in rows]
        finally:
            conn.close()
    except Exception as exc:
        print(f"[orchestrator_db] list_cases notice: {exc}")
        return []


def get_analytics_summary() -> dict:
    """Computes comprehensive analytics across all cases and approval logs from the database."""
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. All cases with essential fields
            cur.execute(
                """
                SELECT case_id, status, change_type, risk_tier, risk_score, final_outcome,
                       to_char(created_at, 'YYYY-MM') AS month_key,
                       to_char(created_at, 'FMMonth YYYY') AS month_label,
                       created_at
                FROM cases
                ORDER BY created_at ASC
                """
            )
            cases = cur.fetchall()

            # 2. Approvals audit count
            cur.execute(
                """
                SELECT gate, actor, decision, decided_at, case_id
                FROM approvals
                ORDER BY decided_at DESC
                """
            )
            approvals = cur.fetchall()

        total = len(cases)
        if total == 0:
            return {
                "total_cases": 0,
                "overall_avg_risk_score": 0.0,
                "tier_counts": {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Pending": 0},
                "status_counts": {},
                "change_type_counts": {},
                "monthly_summaries": [],
                "approval_metrics": {"total_gate1": 0, "total_gate2": 0, "outcomes": {}},
            }

        # Overall tier and status counts
        tier_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Pending": 0}
        status_counts = {}
        change_type_counts = {}
        scored_values = []
        monthly_map = {}

        for c in cases:
            tier = c["risk_tier"] or "Pending"
            if tier in tier_counts:
                tier_counts[tier] += 1
            else:
                tier_counts[tier] = 1

            status = c["status"] or "unknown"
            status_counts[status] = status_counts.get(status, 0) + 1

            raw_ct = c["change_type"] or "other"
            ct_label = raw_ct.replace("_", " ").title()
            change_type_counts[ct_label] = change_type_counts.get(ct_label, 0) + 1

            if c["risk_score"] is not None:
                scored_values.append(float(c["risk_score"]))

            m_key = c["month_key"]
            m_label = (c["month_label"] or "").strip()
            if m_key not in monthly_map:
                monthly_map[m_key] = {
                    "month": m_key,
                    "month_label": m_label,
                    "total_cases": 0,
                    "scores": [],
                    "tier_counts": {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Pending": 0},
                    "status_counts": {},
                    "change_type_counts": {},
                    "approved_count": 0,
                    "rejected_count": 0,
                    "rfi_count": 0,
                }

            entry = monthly_map[m_key]
            entry["total_cases"] += 1
            if c["risk_score"] is not None:
                entry["scores"].append(float(c["risk_score"]))
            entry["tier_counts"][tier] = entry["tier_counts"].get(tier, 0) + 1
            entry["status_counts"][status] = entry["status_counts"].get(status, 0) + 1
            entry["change_type_counts"][ct_label] = entry["change_type_counts"].get(ct_label, 0) + 1

            outcome = (c.get("final_outcome") or "").lower()
            if "approved" in outcome or status == "closed":
                entry["approved_count"] += 1
            if "rejected" in outcome:
                entry["rejected_count"] += 1
            if status in ("needs_more_information", "rfi"):
                entry["rfi_count"] += 1

        # Finalize monthly summaries
        monthly_summaries = []
        for m_key in sorted(monthly_map.keys()):
            data = monthly_map[m_key]
            scores = data.pop("scores")
            data["avg_risk_score"] = round(sum(scores) / len(scores), 2) if scores else 0.0
            monthly_summaries.append(data)

        # Approval metrics
        gate1_count = sum(1 for a in approvals if a["gate"] == "gate1")
        gate2_count = sum(1 for a in approvals if a["gate"] == "gate2")
        outcomes_map = {}
        for a in approvals:
            if a["gate"] == "gate2" and isinstance(a["decision"], dict):
                out = a["decision"].get("outcome", "Decided")
                outcomes_map[out] = outcomes_map.get(out, 0) + 1

        overall_avg = round(sum(scored_values) / len(scored_values), 2) if scored_values else 0.0

        return {
            "total_cases": total,
            "overall_avg_risk_score": overall_avg,
            "tier_counts": tier_counts,
            "status_counts": status_counts,
            "change_type_counts": change_type_counts,
            "monthly_summaries": monthly_summaries,
            "approval_metrics": {
                "total_gate1": gate1_count,
                "total_gate2": gate2_count,
                "outcomes": outcomes_map,
            },
        }
    finally:
        conn.close()


