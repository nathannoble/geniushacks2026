# FCRM Workbench — Sample Change Request Library

This directory contains realistic sample change request documents (in banking-standard PDF format) and testing profiles for demoing, evaluating, and stress-testing the **Financial Crimes Risk Management (FCRM) Multi-Agent Workbench**.

---

## Catalog of Sample Change Requests

| File | Initiative Name | Change Type | Expected Tier | Watchlist / Screening Trigger | Key Entities & Corridors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[`sample_change_request.pdf`](file:///Users/kris/Projects/geniushacks2026/src/fcrm-workbench/sample-files/sample_change_request.pdf)** | Cannabis Dispensary Banking | `new_product` | **Critical** (3.40) | **Sanctions Hit** (`Marcus J. Holloway`) | Green Leaf Dispensary LLC, Great Lakes Cannabis Co., CO/MI, 80% cash |
| **[`003_cross_border_remittance_high_risk.pdf`](file:///Users/kris/Projects/geniushacks2026/src/fcrm-workbench/sample-files/003_cross_border_remittance_high_risk.pdf)** | Cross-Border MSB & Trade Corridor | `new_geography` | **Critical** (3.30) | **Sanctions Hit** (`Meridian Overseas Holdings Ltd`) | Meridian Global Payments LLC, Carlos Mendoza-Vargas, US/MX/Colombia/UAE |
| **[`004_crypto_asset_custody_medium_risk.pdf`](file:///Users/kris/Projects/geniushacks2026/src/fcrm-workbench/sample-files/004_crypto_asset_custody_medium_risk.pdf)** | Institutional Crypto Custody & Staking | `new_product` | **Medium** (1.50) | Clean (0% physical cash, qualified custody) | Aegis Digital Capital LLC, Dr. Helena Vance, Anchorage Trust, NY/DE |
| **[`005_commercial_fleet_card_low_risk.pdf`](file:///Users/kris/Projects/geniushacks2026/src/fcrm-workbench/sample-files/005_commercial_fleet_card_low_risk.pdf)** | Commercial Fleet Fuel & Expense Card | `product_modification` | **Low** (0.25) | Clean (0% cash advance, closed-loop MCC) | Midwest Express Logistics Inc, Robert J. Callahan, TX/IL/OH/IN |
| **[`006_pep_private_wealth_onboarding_high_risk.pdf`](file:///Users/kris/Projects/geniushacks2026/src/fcrm-workbench/sample-files/006_pep_private_wealth_onboarding_high_risk.pdf)** | Offshore Private Wealth Trust Depository | `new_customer_segment` | **High** (Floored by PEP hit) | **PEP Hit** (`Amara Chukwuemeka Obi`) | Obi Heritage Capital Trust, Julian Sterling, Florida/UK/Nigeria/Bahamas |
| **[`007_incomplete_vendor_payment_portal_rfi.pdf`](file:///Users/kris/Projects/geniushacks2026/src/fcrm-workbench/sample-files/007_incomplete_vendor_payment_portal_rfi.pdf)** | Instant Payment Clearing (RTP/FedNow) | `vendor_relationship` | **Needs Info (RFI)** | **Vendor Risk Hit** (`Summit Peak Vendor Services`) | Summit Peak Vendor Services, David Miller, missing target go-live date |

---

## Detailed Case Profiles

### 1. Cross-Border Remittance Corridor (High / Critical Risk)
- **File:** `003_cross_border_remittance_high_risk.pdf`
- **Business Line:** Global Transaction Banking
- **Key Characteristics:** High-velocity SWIFT MT103/MT202 clearing accounts for a FinCEN-registered Money Services Business (MSB). Involves routing funds between the US, Mexico, Colombia (Bogota), and UAE (Dubai DMCC).
- **Compliance Triggers:**
  - Entity `Meridian Overseas Holdings Ltd` matches the Synthetic Sanctions List.
  - High jurisdiction risk score (4/4) under POL-045 for cross-border transit corridors.
  - Requires Gate 1 escalation and Gate 2 Committee ratification.

### 2. Institutional Crypto Custody & Staking (Medium Risk)
- **File:** `004_crypto_asset_custody_medium_risk.pdf`
- **Business Line:** Institutional Wealth & Custody
- **Key Characteristics:** Bankruptcy-remote qualified custody for registered investment advisers (RIAs) and private funds, featuring multi-party computation (MPC) cold storage and validator staking yield.
- **Compliance Triggers:**
  - 0% physical cash (zero currency risk).
  - Clean screening status across all principals (`Dr. Helena Vance`, `Aegis Digital Capital LLC`).
  - Elevated product novelty score (4/4), triggering requirement for audited smart contracts and SOC-2 Type II verification.

### 3. Commercial Fleet Fuel & Maintenance Card (Low Risk)
- **File:** `005_commercial_fleet_card_low_risk.pdf`
- **Business Line:** Commercial Lending & Cards
- **Key Characteristics:** Routine credit ceiling adjustment ($250k to $750k) for established domestic transport operators. Hard MCC controls limit transactions to automated diesel pumps, vehicle maintenance, and highway tolls.
- **Compliance Triggers:**
  - 0% cash advance capability (disabled at Mastercard network level).
  - Purely domestic operations (TX, IL, OH, IN).
  - Fast-track approval path under POL-010 Section 3.2.

### 4. International Private Wealth PEP Depository (High Risk / PEP Floor)
- **File:** `006_pep_private_wealth_onboarding_high_risk.pdf`
- **Business Line:** International Private Bank
- **Key Characteristics:** Discretionary offshore trust depository holding $12.0M inbound wire transfer originating from Barclays London for a non-resident ultra-high-net-worth family.
- **Compliance Triggers:**
  - Principal `Amara Chukwuemeka Obi` triggers an exact match on the Synthetic Politically Exposed Person (PEP) List.
  - POL-045 Section 4.2 rule: Any unresolved PEP hit enforces a mandatory **High** risk tier floor regardless of cash intensity.
  - Mandates Senior Executive & Gate 2 Committee sign-off.

### 5. Instant Payment Vendor Gateway (Incomplete / Gate 1 RFI Loop)
- **File:** `007_incomplete_vendor_payment_portal_rfi.pdf`
- **Business Line:** Digital Payments & Channels
- **Key Characteristics:** Real-Time Payments (RTP) and FedNow API integration with third-party gateway provider.
- **Compliance Triggers:**
  - Vendor `Summit Peak Vendor Services` matches the Synthetic Vendor-Risk Watchlist.
  - Submission intentionally lacks a valid target go-live date and explicit transaction velocity caps.
  - Demonstrates Gate 1 `needs_more_information` status and RFI return to the Product Owner.

---

## How to Upload and Test

### Method A: Drag-and-Drop in the FCRM Workbench Web UI
1. Navigate to the Workbench UI at `http://localhost:8000/ui/`.
2. Click **+ Submit Change Request** on the top navigation bar.
3. Fill in the form fields (or copy the summary from the table above).
4. Drag and drop any of the `.pdf` files from this `sample-files/` folder directly onto the dropzone.
5. Click **Run Multi-Agent Risk Evaluation** to watch the LangGraph pipeline process intake, extraction, retrieval, screening, scoring, and memo generation in real time.

### Method B: Via `curl` API Call
```bash
curl -X POST "http://localhost:8000/cases" \
  -F "product_type=Cross-Border Commercial Remittance Corridor" \
  -F "change_type=new_geography" \
  -F "geography=United States, Mexico, Colombia, United Arab Emirates" \
  -F "segment=Money Services Business / Cross-Border Remittance" \
  -F "target_date=2026-11-15" \
  -F "description=Open multi-currency clearing accounts for cross-border MSBs supporting high-velocity wire remittances." \
  -F "files=@sample-files/003_cross_border_remittance_high_risk.pdf"
```

### Method C: Run Automated Regression Evaluation (M8 Harness)
All generated cases are registered in `eval/golden_cases/`:
```bash
python scripts/run_eval.py
```
