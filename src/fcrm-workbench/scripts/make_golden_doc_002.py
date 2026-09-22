from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

doc = SimpleDocTemplate(
    "eval/golden_docs/atm_limit_change.pdf",
    pagesize=letter,
    topMargin=1 * inch,
    bottomMargin=1 * inch,
)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="H2", parent=styles["Heading2"], spaceBefore=14, spaceAfter=6))

story = [
    Paragraph("Product Change Request", styles["Title"]),
    Paragraph("Daily ATM Withdrawal Limit Increase", styles["Heading3"]),
    Spacer(1, 16),
    Paragraph("1. Overview", styles["H2"]),
    Paragraph(
        "Retail Banking requests an increase to the daily ATM withdrawal limit for existing "
        "retail checking customers, from $500 to $1,000 per day. This change applies only to "
        "customers already holding a retail checking account in good standing for at least "
        "12 months; no new customer segment or product is introduced.",
        styles["Normal"],
    ),
    Paragraph("2. Customer Segment", styles["H2"]),
    Paragraph(
        "Customer type: retail checking. No new customer types, jurisdictions, or vendor "
        "relationships are introduced by this change.",
        styles["Normal"],
    ),
    Paragraph("3. Transaction Profile", styles["H2"]),
    Paragraph(
        "This change affects ATM cash withdrawals only. It does not change deposit patterns, "
        "wire transfer limits, or any other transaction type.",
        styles["Normal"],
    ),
    Paragraph("4. Target Launch", styles["H2"]),
    Paragraph(
        "Retail Banking requests standard FCRM turnaround, consistent with routine product "
        "modifications of this kind.",
        styles["Normal"],
    ),
]

doc.build(story)
print("Wrote eval/golden_docs/atm_limit_change.pdf")
