"""Seed realistic multi-month cases into Supabase PostgreSQL for FCRM Workbench analytics.
Uses ON CONFLICT DO NOTHING so existing cases are preserved.
"""
from __future__ import annotations

import os
import psycopg2
import psycopg2.extras

CASES_DATA = [
    {
        "case_id": "FCRM-2026-0006",
        "product_type": "Commercial Cannabis Dispensary Account",
        "change_type": "New Product Launch",
        "geography": "US-CO, US-MI",
        "segment": "Commercial Banking / Cash Intensive",
        "target_date": "2026-07-20",
        "description": "Depository accounts for state-licensed cannabis operators with 80% armored transport cash deposits.",
        "risk_tier": "High",
        "risk_score": 2.75,
        "status": "closed",
        "final_outcome": "Approved with Conditions",
        "created_at": "2026-07-08T09:30:00Z",
    },
    {
        "case_id": "FCRM-2026-0007",
        "product_type": "Retail ATM Daily Withdrawal Limit Increase",
        "change_type": "Parameter Change",
        "geography": "Domestic (US-Wide)",
        "segment": "Retail Consumer Banking",
        "target_date": "2026-07-28",
        "description": "Increase standard daily debit ATM withdrawal limit from $1,000 to $2,500 for premier accounts.",
        "risk_tier": "Low",
        "risk_score": 0.65,
        "status": "closed",
        "final_outcome": "Approved",
        "created_at": "2026-07-15T14:15:00Z",
    },
    {
        "case_id": "FCRM-2026-0008",
        "product_type": "Cross-Border MSB Remittance Corridor",
        "change_type": "Geographic Expansion",
        "geography": "US, Mexico, Colombia, UAE",
        "segment": "Money Services Business / Cross-Border Remittance",
        "target_date": "2026-08-10",
        "description": "Expansion of wholesale wire remittance corridor to UAE free zones with nested correspondent routing.",
        "risk_tier": "Critical",
        "risk_score": 3.45,
        "status": "closed",
        "final_outcome": "Rejected",
        "created_at": "2026-08-02T11:00:00Z",
    },
    {
        "case_id": "FCRM-2026-0009",
        "product_type": "Digital Asset Custody & Staking",
        "change_type": "New Product Launch",
        "geography": "Domestic (US-Wide), Switzerland",
        "segment": "Institutional & Wealth Management",
        "target_date": "2026-08-25",
        "description": "Cold-storage institutional digital asset custody and proof-of-stake node validation delegation.",
        "risk_tier": "Medium",
        "risk_score": 1.75,
        "status": "closed",
        "final_outcome": "Approved with Conditions",
        "created_at": "2026-08-14T10:45:00Z",
    },
    {
        "case_id": "FCRM-2026-0010",
        "product_type": "Commercial Fleet Fuel & Card Program",
        "change_type": "New Product Launch",
        "geography": "Domestic (US-Wide)",
        "segment": "Commercial Logistics & Transport",
        "target_date": "2026-08-30",
        "description": "Corporate fuel expense cards with restricted merchant category codes (MCC 5541/5542) and telematics integration.",
        "risk_tier": "Low",
        "risk_score": 0.55,
        "status": "closed",
        "final_outcome": "Approved",
        "created_at": "2026-08-22T16:20:00Z",
    },
    {
        "case_id": "FCRM-2026-0011",
        "product_type": "PEP Foreign Trust & Wealth Depository",
        "change_type": "Customer Segment Expansion",
        "geography": "West Africa, UK, US",
        "segment": "Private Wealth Management",
        "target_date": "2026-09-12",
        "description": "Private wealth onboarding for politically exposed person family trust involving multi-jurisdictional offshore assets.",
        "risk_tier": "High",
        "risk_score": 2.85,
        "status": "closed",
        "final_outcome": "Approved with Conditions",
        "created_at": "2026-09-03T08:15:00Z",
    },
    {
        "case_id": "FCRM-2026-0012",
        "product_type": "RTP & FedNow Payment Gateway Integration",
        "change_type": "Vendor Relationship",
        "geography": "Domestic (US-Wide)",
        "segment": "Fintech & Embedded Banking",
        "target_date": "2026-09-18",
        "description": "Cloud-hosted ISO 20022 real-time payments routing gateway integrated with third-party SaaS provider Summit Peak.",
        "risk_tier": "Medium",
        "risk_score": 1.80,
        "status": "closed",
        "final_outcome": "Approved",
        "created_at": "2026-09-10T13:40:00Z",
    },
    {
        "case_id": "FCRM-2026-0013",
        "product_type": "Precious Metals & Bullion Vault Financing",
        "change_type": "New Customer Segment",
        "geography": "US-NY, Switzerland",
        "segment": "Commodities & Trade Finance",
        "target_date": "2026-09-24",
        "description": "Collateralized credit facilities for physical gold and silver bullion dealers with overseas depository holding.",
        "risk_tier": "High",
        "risk_score": 2.60,
        "status": "awaiting_gate2",
        "final_outcome": None,
        "created_at": "2026-09-16T15:00:00Z",
    },
    {
        "case_id": "FCRM-2026-0014",
        "product_type": "Micro-Merchant POS Instant Settlement",
        "change_type": "Product Modification",
        "geography": "Domestic (US-Wide)",
        "segment": "Small Business Banking",
        "target_date": "2026-09-29",
        "description": "Instant batch settlement within 15 minutes for verified micro-merchants on contactless mobile POS terminals.",
        "risk_tier": "Medium",
        "risk_score": 1.40,
        "status": "closed",
        "final_outcome": "Approved",
        "created_at": "2026-09-21T09:10:00Z",
    },
    {
        "case_id": "FCRM-2026-0015",
        "product_type": "Latin America Correspondent Banking Clearing",
        "change_type": "Geographic Expansion",
        "geography": "Brazil, Argentina, US-FL",
        "segment": "Financial Institutions",
        "target_date": "2026-10-15",
        "description": "USD clearing accounts for regional Tier-2 Latin American commercial banks subject to enhanced nested due diligence.",
        "risk_tier": "Critical",
        "risk_score": 3.20,
        "status": "awaiting_gate2",
        "final_outcome": None,
        "created_at": "2026-10-01T10:00:00Z",
    },
    {
        "case_id": "FCRM-2026-0016",
        "product_type": "Automated AI Lending Underwriting Engine",
        "change_type": "Vendor Relationship",
        "geography": "Domestic (US-Wide)",
        "segment": "Consumer Unsecured Credit",
        "target_date": "2026-10-20",
        "description": "Integration of machine learning underwriting model provided by Apex Neural Labs for instant retail credit line decisions.",
        "risk_tier": "Medium",
        "risk_score": 1.90,
        "status": "awaiting_gate1",
        "final_outcome": None,
        "created_at": "2026-10-01T14:30:00Z",
    },
    {
        "case_id": "FCRM-2026-0017",
        "product_type": "Maritime Trade Finance & Bill of Lading Escrow",
        "change_type": "New Product Launch",
        "geography": "Singapore, Panama, US-TX",
        "segment": "Commercial Trade & Shipping",
        "target_date": "2026-10-28",
        "description": "Digital letters of credit and bill of lading escrow services for container vessel logistics and bulk crude shipping.",
        "risk_tier": "High",
        "risk_score": 2.50,
        "status": "awaiting_gate1",
        "final_outcome": None,
        "created_at": "2026-10-02T08:45:00Z",
    },
    {
        "case_id": "FCRM-2026-0018",
        "product_type": "Cross-Border Gaming & Esports Payout API",
        "change_type": "New Customer Segment",
        "geography": "US, Canada, South Korea, Malta",
        "segment": "Interactive Entertainment & Gaming",
        "target_date": "2026-10-31",
        "description": "Real-time mass payout disbursement API for tournament prizes and esports streamer earnings.",
        "risk_tier": "High",
        "risk_score": 2.35,
        "status": "needs_more_information",
        "final_outcome": None,
        "created_at": "2026-10-02T11:20:00Z",
    },
    {
        "case_id": "FCRM-2026-0019",
        "product_type": "Green Energy Equipment Lease Financing",
        "change_type": "New Product Launch",
        "geography": "Domestic (US-Wide)",
        "segment": "Commercial Clean Energy",
        "target_date": "2026-10-25",
        "description": "Secured equipment leasing program for commercial solar and battery storage installations with corporate guarantees.",
        "risk_tier": "Low",
        "risk_score": 0.40,
        "status": "awaiting_gate1",
        "final_outcome": None,
        "created_at": "2026-10-02T12:00:00Z",
    },
]

def seed_cases():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn.cursor() as cur:
            print("Seeding multi-month cases into PostgreSQL (ON CONFLICT DO NOTHING)...")
            inserted = 0
            for c in CASES_DATA:
                sub = {
                    "product_type": c["product_type"],
                    "change_type": c["change_type"],
                    "geography": c["geography"],
                    "segment": c["segment"],
                    "target_date": c["target_date"],
                    "description": c["description"],
                }
                cur.execute(
                    """
                    INSERT INTO cases (
                        case_id, status, change_type, change_type_confidence,
                        missing_fields, submission, documents, risk_tier, risk_score,
                        final_outcome, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s
                    )
                    ON CONFLICT (case_id) DO NOTHING
                    RETURNING case_id;
                    """,
                    (
                        c["case_id"],
                        c["status"],
                        c["change_type"].lower().replace(" ", "_"),
                        0.92,
                        psycopg2.extras.Json([] if c["status"] != "needs_more_information" else ["target_date"]),
                        psycopg2.extras.Json(sub),
                        psycopg2.extras.Json([]),
                        c["risk_tier"],
                        c["risk_score"],
                        c["final_outcome"],
                        c["created_at"],
                        c["created_at"],
                    )
                )
                res = cur.fetchone()
                if res:
                    inserted += 1
                    # Approvals
                    if c["status"] == "closed":
                        cur.execute(
                            """
                            INSERT INTO approvals (case_id, gate, actor, decision, decided_at)
                            VALUES (%s, 'gate1', 'Senior Analyst', %s, %s)
                            """,
                            (c["case_id"], psycopg2.extras.Json({"action": "finalize", "notes": "Verified facts and screening"}), c["created_at"])
                        )
                        cur.execute(
                            """
                            INSERT INTO approvals (case_id, gate, actor, decision, decided_at)
                            VALUES (%s, 'gate2', 'FCRM Oversight Committee', %s, %s)
                            """,
                            (c["case_id"], psycopg2.extras.Json({"outcome": c["final_outcome"], "conditions": ["Quarterly volume audit", "Negative news monitoring"]}), c["created_at"])
                        )
                    elif c["status"] == "awaiting_gate2":
                        cur.execute(
                            """
                            INSERT INTO approvals (case_id, gate, actor, decision, decided_at)
                            VALUES (%s, 'gate1', 'Lead Compliance Officer', %s, %s)
                            """,
                            (c["case_id"], psycopg2.extras.Json({"action": "finalize", "notes": "Recommended for committee review"}), c["created_at"])
                        )

            # Update sequence
            cur.execute(
                """
                INSERT INTO case_id_sequences (year, last_value)
                VALUES (2026, 19)
                ON CONFLICT (year) DO UPDATE SET last_value = GREATEST(case_id_sequences.last_value, 19);
                """
            )
            conn.commit()
            print(f"Successfully inserted {inserted} new cases! Total data ready for analytics.")
    finally:
        conn.close()

if __name__ == "__main__":
    seed_cases()
