import os
import resend
from .db import get_emails_by_role, get_case_details

resend.api_key = os.environ.get("RESEND_API_KEY")

def generate_email_html(event_type: str, case_id: str, detail: str) -> str:
    # Fetch extra case details for the "At-a-Glance" context
    case_data = get_case_details(case_id)
    
    # Safely extract details or set fallbacks
    risk_tier = case_data.get("risk_tier") or "Pending"
    risk_score = case_data.get("risk_score") or "N/A"
    change_type = (case_data.get("change_type") or "unknown_change").replace("_", " ").title()
    
    submission = case_data.get("submission") or {}
    entity_name = submission.get("product_type") or "Unknown Entity / Product"

    # Determine badge color based on Risk Tier
    risk_color = "#94a3b8" # Default Slate
    if risk_tier.lower() == "critical":
        risk_color = "#dc2626" # Crimson
    elif risk_tier.lower() == "high":
        risk_color = "#ea580c" # Amber
    elif risk_tier.lower() in ["medium", "low"]:
        risk_color = "#16a34a" # Green

    if event_type == "awaiting_gate1_review":
        title = "Gate 1 Review Required"
        subtitle = "A draft assessment is ready for Analyst review."
        action_text = f"Review Case {case_id}"
    elif event_type == "awaiting_gate2_review":
        title = "Gate 2 Decision Required"
        subtitle = "Analyst has finalized the case. Committee decision needed."
        action_text = f"Review Case {case_id}"
    else:
        title = "Case Notification"
        subtitle = "There is an update on your FCRM case."
        action_text = f"View Case {case_id}"
        
    dashboard_url = f"http://localhost:5173/case/{case_id}"

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
    <style>
        body {{ font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px; }}
        .container {{ max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }}
        .header {{ background-color: #0f172a; padding: 30px 20px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }}
        .header p {{ margin: 6px 0 0 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }}
        .banner {{ background-color: #2563eb; padding: 40px 30px; text-align: center; color: #ffffff; position: relative; }}
        .banner h2 {{ margin: 0; font-size: 26px; font-weight: 700; }}
        .banner p {{ margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 400; }}
        .content {{ padding: 40px; color: #334155; line-height: 1.6; }}
        .greeting {{ font-size: 16px; margin-bottom: 25px; }}
        
        .data-table {{ width: 100%; border-collapse: collapse; margin: 25px 0; background-color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }}
        .data-row {{ border-bottom: 1px solid #e2e8f0; }}
        .data-row:last-child {{ border-bottom: none; }}
        .data-label {{ padding: 12px 16px; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; width: 35%; background-color: #f1f5f9; }}
        .data-value {{ padding: 12px 16px; font-size: 15px; color: #0f172a; font-weight: 500; }}
        
        .risk-badge {{ display: inline-block; padding: 4px 10px; border-radius: 6px; color: #fff; font-size: 12px; font-weight: 700; background-color: {risk_color}; }}
        
        .summary-box {{ margin: 30px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }}
        .summary-header {{ background-color: #f8fafc; padding: 10px 16px; font-size: 13px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }}
        .summary-body {{ padding: 16px; font-size: 15px; color: #1e293b; background-color: #ffffff; font-style: italic; }}
        
        .button-container {{ text-align: center; margin: 40px 0 20px 0; }}
        .button {{ display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; transition: background-color 0.2s; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }}
        .button:hover {{ background-color: #1d4ed8; }}
        
        .help-box {{ background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px 20px; font-size: 14px; color: #475569; border-radius: 0 8px 8px 0; margin-top: 30px; }}
        .footer {{ background-color: #0f172a; padding: 25px; text-align: center; color: #64748b; font-size: 13px; border-top: 1px solid #1e293b; }}
    </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>FCRM Workbench</h1>
                <p>Advanced Agentic Investigation</p>
            </div>
            <div class="banner">
                <h2>{title}</h2>
                <p>{subtitle}</p>
            </div>
            <div class="content">
                <div class="greeting">Hi there,</div>
                <p style="font-size: 16px; margin: 0 0 20px 0;">Case <strong>{case_id}</strong> requires your immediate attention.</p>
                
                <table class="data-table">
                    <tr class="data-row">
                        <td class="data-label">Entity / Subject</td>
                        <td class="data-value">{entity_name}</td>
                    </tr>
                    <tr class="data-row">
                        <td class="data-label">Request Type</td>
                        <td class="data-value">{change_type}</td>
                    </tr>
                    <tr class="data-row">
                        <td class="data-label">AI Risk Tier</td>
                        <td class="data-value"><span class="risk-badge">{risk_tier.upper()}</span> (Score: {risk_score})</td>
                    </tr>
                </table>
                
                <div class="button-container">
                    <a href="{dashboard_url}" class="button">{action_text}</a>
                </div>
                
                <div class="help-box">
                    <strong>SLA Target:</strong> 48 hours from submission.<br><br>
                    <strong>Need more context?</strong> You can review the full AI-generated assessment, extracted facts, and document evidence directly in the Workbench dashboard before making your decision.
                </div>
            </div>
            <div class="footer">
                FCRM Workbench by GeniusHacks2026 &copy; 2026
            </div>
        </div>
    </body>
    </html>
    """

def send_notification_email(event_type: str, case_id: str, detail: str = ""):
    if not resend.api_key:
        print("[Email] Resend API key not configured.")
        return

    # Determine target emails based on event_type
    target_emails = []
    if event_type == "awaiting_gate1_review":
        target_emails = get_emails_by_role("Compliance Analyst")
    elif event_type == "awaiting_gate2_review":
        target_emails = get_emails_by_role("Risk Committee Chair")
    
    if not target_emails:
        print(f"[Email] No valid users found for event {event_type}. Skipping email.")
        return

    subject = f"FCRM Action Required: Case {case_id}"
    html_content = generate_email_html(event_type, case_id, detail)

    try:
        r = resend.Emails.send({
            "from": "FCRM Workbench <hello@knoatechsolutions.com>",
            "to": target_emails,
            "subject": subject,
            "html": html_content
        })
        print(f"[Email] Sent notification for {case_id} to {target_emails}")
    except Exception as e:
        print(f"[Email] Failed to send email: {e}")
