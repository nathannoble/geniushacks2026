#!/usr/bin/env python3
"""Script to generate realistic banking change request PDF documents and
matching golden evaluation cases for the FCRM Workbench.

Generates:
1. 003_cross_border_remittance_high_risk.pdf
   - Cross-Border MSB & Remittance Corridor (LATAM / UAE)
   - Triggers Sanctions screening hit on 'Meridian Overseas Holdings Ltd'
   - Expected Risk Tier: Critical / High
2. 004_crypto_asset_custody_medium_risk.pdf
   - Institutional Digital Asset Custody & Staking Service
   - High product novelty, 0% cash, clean screening
   - Expected Risk Tier: Medium
3. 005_commercial_fleet_card_low_risk.pdf
   - Commercial Fleet Fuel & Expense Corporate Credit Program
   - Domestic US, low cash intensity, established product
   - Expected Risk Tier: Low
4. 006_pep_private_wealth_onboarding_high_risk.pdf
   - Ultra-High-Net-Worth Foreign Trust & Private Depository
   - Triggers PEP screening hit on 'Amara Chukwuemeka Obi'
   - Tests screening-hit floor rule -> Expected Tier: High
5. 007_incomplete_vendor_payment_portal_rfi.pdf
   - Real-Time Payment (RTP/FedNow) Gateway Vendor Integration
   - Triggers Vendor-Risk watchlist hit on 'Summit Peak Vendor Services'
   - Intentionally lacks target date & complete volume bounds
   - Expected Result: Gate 1 RFI Loop (needs_more_information)

Outputs to both:
- src/fcrm-workbench/sample-files/
- src/fcrm-workbench/eval/golden_docs/
and registers golden cases in:
- src/fcrm-workbench/eval/golden_cases/
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT_DIR = Path(__file__).resolve().parent.parent
SAMPLE_DIR = ROOT_DIR / "sample-files"
GOLDEN_DOCS_DIR = ROOT_DIR / "eval" / "golden_docs"
GOLDEN_CASES_DIR = ROOT_DIR / "eval" / "golden_cases"

SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
GOLDEN_DOCS_DIR.mkdir(parents=True, exist_ok=True)
GOLDEN_CASES_DIR.mkdir(parents=True, exist_ok=True)


def build_pdf(
    filename: str,
    title: str,
    subtitle: str,
    meta_rows: list[list[str]],
    sections: list[tuple[str, list[str]]],
):
    target_sample = SAMPLE_DIR / filename
    target_golden = GOLDEN_DOCS_DIR / filename

    doc = SimpleDocTemplate(
        str(target_sample),
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    header_style = ParagraphStyle(
        name="BankHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
    )
    sub_header_style = ParagraphStyle(
        name="BankSubHeader",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"),
    )
    title_style = ParagraphStyle(
        name="DocTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        alignment=0,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        name="DocSubTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#0284c7"),
        spaceAfter=12,
    )
    h2_style = ParagraphStyle(
        name="SectionH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=10,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        name="BodyTextCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6,
    )
    meta_label = ParagraphStyle(
        name="MetaLabel",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#475569"),
    )
    meta_val = ParagraphStyle(
        name="MetaVal",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
    )

    story = []

    # Bank branding header
    story.append(Paragraph("MERIDIAN PACIFIC COMMERCIAL BANK", header_style))
    story.append(
        Paragraph("FINANCIAL CRIMES RISK MANAGEMENT (FCRM) DIVISION • FORM CR-2026", sub_header_style)
    )
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=10))

    # Title & Subtitle
    story.append(Paragraph(title, title_style))
    story.append(Paragraph(subtitle, subtitle_style))

    # Metadata Grid Table
    formatted_table_data = []
    for row in meta_rows:
        formatted_row = []
        for i, cell in enumerate(row):
            style = meta_label if (i % 2 == 0) else meta_val
            formatted_row.append(Paragraph(cell, style))
        formatted_table_data.append(formatted_row)

    meta_table = Table(
        formatted_table_data,
        colWidths=[1.4 * inch, 2.1 * inch, 1.4 * inch, 2.1 * inch],
    )
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # Document sections
    for sec_title, paragraphs in sections:
        story.append(Paragraph(sec_title, h2_style))
        for p in paragraphs:
            story.append(Paragraph(p, body_style))
        story.append(Spacer(1, 4))

    doc.build(story)
    shutil.copy2(target_sample, target_golden)
    print(f"Generated: {target_sample.name} -> sample-files/ & eval/golden_docs/")


def create_all_samples():
    # -------------------------------------------------------------
    # CASE 003: Cross-Border High-Risk Remittance Corridor
    # -------------------------------------------------------------
    build_pdf(
        filename="003_cross_border_remittance_high_risk.pdf",
        title="Product Change Request: Cross-Border Commercial Remittance Corridor",
        subtitle="Expansion into High-Velocity Latin America & UAE Trade Settlement Accounts",
        meta_rows=[
            ["Initiative Ref:", "PCR-2026-0881", "Change Type:", "Geographic Expansion"],
            ["Business Division:", "Global Transaction Banking", "Risk Officer:", "Sarah Lin, Director"],
            ["Target Go-Live:", "2026-11-15", "Screening Status:", "Pending Screening Review"],
        ],
        sections=[
            (
                "1. Executive Summary & Change Scope",
                [
                    "Global Transaction Banking requests authorization to open multi-currency operational clearing "
                    "accounts for cross-border Money Services Businesses (MSBs) and commercial trade aggregators. "
                    "This change expands the bank's wire transfer settlement corridor to support payment routing "
                    "between North America, Latin America, and designated commercial free zones in the United Arab Emirates.",
                    "The initiative introduces nested correspondent relationships and automated SWIFT MT103/MT202 "
                    "clearing capabilities for high-frequency business remittances.",
                ],
            ),
            (
                "2. Counterparty Entities & Beneficial Ownership",
                [
                    "Primary Applicant: Meridian Global Payments LLC, an authorized foreign exchange and commercial "
                    "remittance aggregator registered as an MSB with FinCEN (Registration No. 310002891142). Customer type: "
                    "money services business.",
                    "Key Intermediary / Affiliate: Meridian Overseas Holdings Ltd, operating as offshore liquidity and "
                    "settlement conduit. Ownership: 45% held by Meridian Overseas Holdings Ltd.",
                    "Executive Principal: Carlos Mendoza-Vargas (Managing Director and Controlling Beneficial Owner, 55% voting equity).",
                ],
            ),
            (
                "3. Operational Jurisdictions & Cross-Border Corridors",
                [
                    "Originating Jurisdictions: United States (Florida, New York, Delaware) and Mexico.",
                    "Transit & Destination Corridors: Colombia (Bogota, Medellin) and United Arab Emirates (Dubai DMCC / Abu Dhabi).",
                    "No direct customer exposure in sanctioned jurisdictions; however, transit through UAE free-zone trade corridors "
                    "requires enhanced transaction monitoring under POL-045 and Bank Secrecy Act cross-border standards.",
                ],
            ),
            (
                "4. Transaction Mechanics & Currency Profile",
                [
                    "Anticipated Monthly Inflows: $18,500,000 to $25,000,000 across wire transfers and correspondent book transfers.",
                    "Physical Cash Intensity: 0% physical currency. All funding occurs via commercial SWIFT wires and Fedwire.",
                    "Settlement Velocity: High-velocity same-day turnover with average individual transaction size of $145,000.",
                ],
            ),
            (
                "5. Third-Party Vendors & Custody Relationships",
                [
                    "SWIFT Messaging Hub: Alliance Cloud Financial Messaging Interface.",
                    "Liquidity Provider: Banco Mercantil de Las Americas (Bogota) and Emirates NBD Correspondent Banking Unit.",
                ],
            ),
            (
                "6. Target Launch & Governance",
                [
                    "Target production implementation date: November 15, 2026. Because of cross-border corridors and nested "
                    "correspondent accounts, this submission requires full Gate 1 review and formal FCRM Governance Committee sign-off.",
                ],
            ),
        ],
    )

    # -------------------------------------------------------------
    # CASE 004: Institutional Digital Asset Custody & Staking
    # -------------------------------------------------------------
    build_pdf(
        filename="004_crypto_asset_custody_medium_risk.pdf",
        title="Product Change Request: Institutional Digital Asset Custody & Staking",
        subtitle="Qualified Custodial Depository & Proof-of-Stake Validation for Registered Funds",
        meta_rows=[
            ["Initiative Ref:", "PCR-2026-1042", "Change Type:", "New Product Launch"],
            ["Business Division:", "Institutional Wealth & Custody", "Risk Officer:", "Marcus Vance, VP"],
            ["Target Go-Live:", "2026-10-30", "Screening Status:", "Clean (Pre-Screened)"],
        ],
        sections=[
            (
                "1. Overview & Business Rationale",
                [
                    "Institutional Wealth & Custody proposes the launch of a segregated Digital Asset Custodial "
                    "Service for registered investment advisers (RIAs), private equity funds, and accredited family offices. "
                    "The product allows institutional clients to hold institutional digital assets (ETH, SOL, USDC) "
                    "in bankruptcy-remote qualified custody accounts with an optional validator staking yield module.",
                ],
            ),
            (
                "2. Customer Segment & Key Entities",
                [
                    "Target Customer Segment: institutional digital asset managers, SEC-registered funds, and qualified institutional buyers.",
                    "Anchor Institutional Client: Aegis Digital Capital LLC, a Delaware registered investment fund with $280M AUM.",
                    "Chief Compliance Officer: Dr. Helena Vance (Key Individual). Beneficial Owners: Arthur Pendelton (35%), Michael Chang (35%).",
                    "Customer type: registered investment adviser / institutional fund.",
                ],
            ),
            (
                "3. Operational Jurisdictions",
                [
                    "The service will be offered exclusively to entities legally organized within the United States: "
                    "New York, Delaware, and California. Non-US residents and foreign jurisdictions are strictly excluded from V1.",
                ],
            ),
            (
                "4. Transaction Mechanics & Cash Profile",
                [
                    "Physical Cash Intensity: 0% physical currency. No physical cash, money orders, or teller operations are permitted.",
                    "Deposits & Withdrawals: Fedwire USD settlement for fiat on-ramp; multi-party computation (MPC) cold storage for digital assets.",
                    "Projected Volume: $45M custodial AUM in Q4 2026, generating approximately 15-30 staking and settlement events per week.",
                ],
            ),
            (
                "5. Third-Party Vendor Relationships",
                [
                    "Qualified Sub-Custodian: Anchorage Trust Corp (South Dakota chartered trust company).",
                    "Key Infrastructure: Fireblocks Inc (MPC key management architecture) and Chainalysis KYT (real-time blockchain analytics).",
                ],
            ),
            (
                "6. Compliance & Target Launch",
                [
                    "Target Launch Date: October 30, 2026. The novelty of cryptographic validator staking warrants moderate product risk "
                    "classification, audited smart-contract verification, and ongoing SOC-2 Type II controls.",
                ],
            ),
        ],
    )

    # -------------------------------------------------------------
    # CASE 005: Commercial Fleet Fuel & Expense Card (Low Risk)
    # -------------------------------------------------------------
    build_pdf(
        filename="005_commercial_fleet_card_low_risk.pdf",
        title="Product Change Request: Commercial Fleet Fuel & Maintenance Card",
        subtitle="Corporate Expense Credit Line Expansion for Domestic Transport Operators",
        meta_rows=[
            ["Initiative Ref:", "PCR-2026-0419", "Change Type:", "Product Modification"],
            ["Business Division:", "Commercial Lending & Cards", "Risk Officer:", "David O'Connor, VP"],
            ["Target Go-Live:", "2026-10-01", "Screening Status:", "Clean"],
        ],
        sections=[
            (
                "1. Overview & Initiative Scope",
                [
                    "Commercial Lending proposes a routine product modification to the existing Corporate Fleet Card program, "
                    "authorizing an increased credit ceiling from $250,000 to $750,000 for verified logistics companies. "
                    "The card features hard Merchant Category Code (MCC) velocity controls restricting card usage exclusively "
                    "to automated fuel pumps, commercial truck repairs, and highway tolls.",
                ],
            ),
            (
                "2. Customer Segment & Key Entities",
                [
                    "Target Segment: Domestic commercial freight logistics companies and regional transport operators.",
                    "Pilot Corporate Customer: Midwest Express Logistics Inc (ICC Motor Carrier No. MC-892110).",
                    "Beneficial Owner: Robert J. Callahan (100% equity). Customer type: commercial transportation operator.",
                ],
            ),
            (
                "3. Operating Jurisdictions",
                [
                    "Operations are confined strictly within the United States: Texas, Illinois, Ohio, and Indiana. "
                    "No foreign transactions, international cardholder billing, or cross-border travel are enabled.",
                ],
            ),
            (
                "4. Transaction Mechanics & Cash Profile",
                [
                    "Cash Advance Facility: Disabled at network level. 0% cash withdrawal capability.",
                    "Settlement: Automated Clearing House (ACH) commercial debits on Net-30 revolving business terms.",
                    "Transaction Type: Closed-loop POS fleet transactions with automated fuel pump telematics.",
                ],
            ),
            (
                "5. Vendor Network",
                [
                    "Payment Network: Mastercard Commercial Fleet Network and WEX Fleet Clearing Solutions.",
                ],
            ),
            (
                "6. Regulatory Governance & Timeline",
                [
                    "Target Go-Live Date: October 1, 2026. Routine modification of an existing credit line; minimal financial "
                    "crimes exposure, qualified for fast-track Gate 1 approval under POL-010 Section 3.2.",
                ],
            ),
        ],
    )

    # -------------------------------------------------------------
    # CASE 006: Non-Resident Private Wealth PEP Onboarding
    # -------------------------------------------------------------
    build_pdf(
        filename="006_pep_private_wealth_onboarding_high_risk.pdf",
        title="Product Change Request: International Private Wealth Trust Depository",
        subtitle="Customer Segment Expansion — Ultra-High-Net-Worth Foreign Trust Depository",
        meta_rows=[
            ["Initiative Ref:", "PCR-2026-1190", "Change Type:", "Customer Segment Expansion"],
            ["Business Division:", "International Private Bank", "Risk Officer:", "Julian Sterling, Managing Dir"],
            ["Target Go-Live:", "2026-11-01", "Screening Status:", "PEP Identified — Amara Chukwuemeka Obi"],
        ],
        sections=[
            (
                "1. Overview & Service Request",
                [
                    "The International Private Banking division requests approval to establish a specialized wealth management "
                    "depository and custodial investment account structure for foreign ultra-high-net-worth (UHNW) families "
                    "utilizing offshore trust and corporate holding vehicles.",
                ],
            ),
            (
                "2. Primary Customer & Beneficial Ownership",
                [
                    "Primary Named Principal: Amara Chukwuemeka Obi, former government infrastructure minister and corporate executive. "
                    "Beneficial ownership: 100% economic beneficiary of Obi Heritage Capital Trust.",
                    "Holding Vehicle: Obi Heritage Capital Trust, a discretionary wealth preservation trust organized under Bahamas trust law. "
                    "Customer type: non-resident private wealth trust / PEP.",
                ],
            ),
            (
                "3. Operational Jurisdictions",
                [
                    "Jurisdictions: United States (Florida - Miami Private Banking Center), United Kingdom (London), and Nigeria (Lagos).",
                    "Source of Wealth: Corporate equity liquidation from telecommunications concessions and African infrastructure development holdings.",
                ],
            ),
            (
                "4. Transaction Profile",
                [
                    "Initial Inflow: $12,000,000 inbound wire transfer originating from Barclays Bank PLC (London).",
                    "Physical Cash Intensity: 0% cash. Physical currency deposits are strictly prohibited in the private banking facility.",
                    "Ongoing Velocity: 4 to 8 high-value wire transfers per quarter for capital calls, tax disbursements, and liquid bond investments.",
                ],
            ),
            (
                "5. Third-Party Service Providers",
                [
                    "Trust Administrator: Sovereign Trust Management (Bahamas) Ltd. Legal Counsel: White & Case LLP.",
                ],
            ),
            (
                "6. Target Launch & Escalation",
                [
                    "Target Date: November 1, 2026. Because Amara Chukwuemeka Obi is a Politically Exposed Person (PEP), "
                    "POL-045 mandates a minimum High risk floor, enhanced source-of-wealth validation, and Gate 2 Committee ratification.",
                ],
            ),
        ],
    )

    # -------------------------------------------------------------
    # CASE 007: Real-Time Payment Vendor Gateway (Incomplete / RFI)
    # -------------------------------------------------------------
    build_pdf(
        filename="007_incomplete_vendor_payment_portal_rfi.pdf",
        title="Product Change Request: Instant Payment Clearing & Vendor Gateway",
        subtitle="Third-Party Vendor Onboarding — RTP & FedNow Gateway Integration",
        meta_rows=[
            ["Initiative Ref:", "PCR-2026-0305", "Change Type:", "Vendor Relationship"],
            ["Business Division:", "Payments & Digital Channels", "Risk Officer:", "David Miller, Lead Analyst"],
            ["Target Go-Live:", "[PENDING CLARIFICATION]", "Screening Status:", "Vendor Alert Triggered"],
        ],
        sections=[
            (
                "1. Overview",
                [
                    "Digital Payments submits a proposal to integrate a third-party application programming interface (API) "
                    "gateway to support 24/7 instant retail credit push disbursements through The Clearing House Real-Time "
                    "Payments (RTP) and Federal Reserve FedNow networks.",
                ],
            ),
            (
                "2. Vendor Information & Entities",
                [
                    "Technology Vendor Partner: Summit Peak Vendor Services, a technology contractor providing core connectivity "
                    "and routing algorithms for immediate fund settlements.",
                    "Customer type: third-party payment service provider.",
                    "Entity Status: Summit Peak Vendor Services is subject to ongoing vendor risk review.",
                ],
            ),
            (
                "3. Jurisdictions & Geographic Scope",
                [
                    "Operating Jurisdictions: Nationwide domestic payment coverage.",
                    "Specific operating state licensing, processing data center locations, and business continuity redundant nodes "
                    "have not yet been specified by the vendor.",
                ],
            ),
            (
                "4. Transaction Profile",
                [
                    "Expected Transaction Type: Real-time electronic credit push payments.",
                    "Volume Projection: Estimated $50M/month aggregate throughput; maximum single-transaction limit has not been finalized.",
                    "Cash Intensity: 0% physical currency.",
                ],
            ),
            (
                "5. Outstanding Documentation & Deficiencies",
                [
                    "Missing: Final third-party SOC-2 audit report, PCI-DSS compliance attestation, transaction velocity caps, "
                    "and signed indemnification schedule. Target production go-live date remains unscheduled.",
                ],
            ),
            (
                "6. Intake Disposition",
                [
                    "This case lacks required operational dates and risk control parameters. Per FCRM procedure M1, this case "
                    "must be flagged as needs_more_information for a Gate 1 Request for Information (RFI) to the product owner.",
                ],
            ),
        ],
    )


def create_golden_case_json_files():
    cases = [
        {
            "name": "003_cross_border_remittance_high_risk",
            "description": "Cross-border commercial remittance corridor with an active screening hit (Meridian Overseas Holdings Ltd) and high-velocity international wire transfers — expects Critical/High tier.",
            "document_path": "sample-files/003_cross_border_remittance_high_risk.pdf",
            "submission": {
                "product_type": "Cross-Border Commercial Remittance Corridor",
                "change_type": "new_geography",
                "geography": "United States, Mexico, Colombia, United Arab Emirates",
                "segment": "Money Services Business / Cross-Border Remittance",
                "target_date": "2026-11-15",
                "description": "Open multi-currency clearing accounts for cross-border MSBs supporting high-velocity wire remittances across the US, Mexico, Colombia, and UAE free zones.",
            },
            "expected_facts": [
                "Meridian Global Payments LLC",
                "Meridian Overseas Holdings Ltd",
                "Carlos Mendoza-Vargas",
                "money services business",
                "wire transfers",
            ],
            "factor_scores": {
                "cash_percentage": 2,
                "jurisdiction_risk": 4,
                "screening_hit_severity": 4,
                "product_novelty": 3,
                "prior_exam_findings": 2,
            },
            "has_unresolved_screening_hit": True,
            "expected_tier": "Critical",
        },
        {
            "name": "004_crypto_asset_custody_medium_risk",
            "description": "Institutional digital asset qualified custody and staking service with clean screening and 0% physical cash — expects Medium risk tier.",
            "document_path": "sample-files/004_crypto_asset_custody_medium_risk.pdf",
            "submission": {
                "product_type": "Institutional Digital Asset Custody & Staking",
                "change_type": "new_product",
                "geography": "New York, Delaware, California",
                "segment": "Institutional Wealth & Registered Investment Funds",
                "target_date": "2026-10-30",
                "description": "Segregated digital asset custodial service with validator staking yield for institutional funds and RIAs in NY and DE.",
            },
            "expected_facts": [
                "Aegis Digital Capital LLC",
                "Dr. Helena Vance",
                "Anchorage Trust Corp",
                "registered investment adviser",
            ],
            "factor_scores": {
                "cash_percentage": 1,
                "jurisdiction_risk": 2,
                "screening_hit_severity": 0,
                "product_novelty": 4,
                "prior_exam_findings": 2,
            },
            "has_unresolved_screening_hit": False,
            "expected_tier": "Medium",
        },
        {
            "name": "005_commercial_fleet_card_low_risk",
            "description": "Commercial corporate fleet expense and fuel card limit increase for domestic transportation firm — clean screening, 0% cash, expects Low risk tier.",
            "document_path": "sample-files/005_commercial_fleet_card_low_risk.pdf",
            "submission": {
                "product_type": "Commercial Fleet Fuel & Maintenance Credit Card",
                "change_type": "product_modification",
                "geography": "Texas, Illinois, Ohio, Indiana",
                "segment": "Commercial Transportation & Logistics",
                "target_date": "2026-10-01",
                "description": "Increase revolving corporate credit ceiling from $250k to $750k for verified domestic freight logistics company with hard MCC fuel controls.",
            },
            "expected_facts": [
                "Midwest Express Logistics Inc",
                "Robert J. Callahan",
                "Mastercard Commercial Fleet Network",
                "commercial transportation operator",
            ],
            "factor_scores": {
                "cash_percentage": 0,
                "jurisdiction_risk": 0,
                "screening_hit_severity": 0,
                "product_novelty": 1,
                "prior_exam_findings": 1,
            },
            "has_unresolved_screening_hit": False,
            "expected_tier": "Low",
        },
        {
            "name": "006_pep_private_wealth_onboarding_high_risk",
            "description": "Offshore trust depository onboarding for Politically Exposed Person (Amara Chukwuemeka Obi) — tests screening-hit floor rule under POL-045, expects High tier.",
            "document_path": "sample-files/006_pep_private_wealth_onboarding_high_risk.pdf",
            "submission": {
                "product_type": "International Private Wealth Trust Depository",
                "change_type": "new_customer_segment",
                "geography": "Florida, United Kingdom, Nigeria, Bahamas",
                "segment": "Non-Resident Ultra-High-Net-Worth Private Banking",
                "target_date": "2026-11-01",
                "description": "Establish wealth depository and investment custodial accounts for non-resident UHNW trust holding vehicle owned by Amara Chukwuemeka Obi.",
            },
            "expected_facts": [
                "Amara Chukwuemeka Obi",
                "Obi Heritage Capital Trust",
                "Florida",
                "Nigeria",
            ],
            "factor_scores": {
                "cash_percentage": 0,
                "jurisdiction_risk": 2,
                "screening_hit_severity": 3,
                "product_novelty": 2,
                "prior_exam_findings": 1,
            },
            "has_unresolved_screening_hit": True,
            "expected_tier": "High",
        },
        {
            "name": "007_incomplete_vendor_payment_portal_rfi",
            "description": "Third-party payment gateway integration with vendor watchlist hit (Summit Peak Vendor Services) and missing target date / operational metrics — tests Gate 1 RFI flow.",
            "document_path": "sample-files/007_incomplete_vendor_payment_portal_rfi.pdf",
            "submission": {
                "product_type": "Instant Payment Clearing & Vendor Gateway",
                "change_type": "vendor_relationship",
                "geography": "United States",
                "segment": "Third-Party Payment Service Provider",
                "target_date": None,
                "description": "API integration with third-party gateway for real-time retail credit push disbursements through RTP and FedNow.",
            },
            "expected_facts": [
                "Summit Peak Vendor Services",
                "David Miller",
                "third-party payment service provider",
            ],
            "factor_scores": {
                "cash_percentage": 0,
                "jurisdiction_risk": 1,
                "screening_hit_severity": 2,
                "product_novelty": 3,
                "prior_exam_findings": 1,
            },
            "has_unresolved_screening_hit": False,
            "expected_tier": "Medium",
        },
    ]

    for c in cases:
        target = GOLDEN_CASES_DIR / f"{c['name']}.json"
        target.write_text(json.dumps(c, indent=2) + "\n")
        print(f"Wrote golden case: {target.name}")


if __name__ == "__main__":
    print("Generating banking change request PDFs and Golden Cases...")
    create_all_samples()
    create_golden_case_json_files()
    print("Done! All sample files and evaluation cases generated successfully.")
