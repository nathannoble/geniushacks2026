import os
import resend

resend.api_key = os.environ.get("RESEND_API_KEY")
TO_EMAIL = os.environ.get("NOTIFICATION_EMAIL", "delivered@resend.dev")

def generate_email_html(event_type: str, case_id: str, detail: str) -> str:
    if event_type == "awaiting_gate1_review":
        title = "Gate 1 Review Required"
        subtitle = "A draft assessment is ready for Analyst review."
        action_text = "Review Case"
    elif event_type == "awaiting_gate2_review":
        title = "Gate 2 Decision Required"
        subtitle = "Analyst has finalized the case. Committee decision needed."
        action_text = "Make Decision"
    else:
        title = "Case Notification"
        subtitle = "There is an update on your FCRM case."
        action_text = "View Case"
        
    dashboard_url = f"http://localhost:5173"

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
    <style>
        body {{ font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f4f8; margin: 0; padding: 40px 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }}
        .header {{ background-color: #0f172a; padding: 35px 20px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px; }}
        .header p {{ margin: 8px 0 0 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }}
        .banner {{ background-color: #2563eb; padding: 45px 30px; text-align: center; color: #ffffff; }}
        .banner h2 {{ margin: 0; font-size: 28px; font-weight: 700; }}
        .banner p {{ margin: 12px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 400; }}
        .content {{ padding: 40px 40px; color: #334155; line-height: 1.7; }}
        .content p {{ margin: 0 0 20px 0; font-size: 16px; }}
        .button-container {{ text-align: center; margin: 35px 0; }}
        .button {{ display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; transition: background-color 0.2s; }}
        .help-box {{ background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 20px; font-size: 14px; color: #475569; margin-bottom: 10px; border-radius: 0 8px 8px 0; }}
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
                <p>Hi there,</p>
                <p>The case <strong>{case_id}</strong> requires your immediate attention. {detail}</p>
                
                <div class="button-container">
                    <a href="{dashboard_url}" class="button">{action_text}</a>
                </div>
                
                <div class="help-box">
                    <strong>Need more context?</strong> You can review the full AI-generated assessment, extracted facts, and document evidence directly in the Workbench dashboard before making your decision.
                </div>
                <p style="text-align: center; font-size: 14px; color: #94a3b8; margin-top: 35px;">Thank you for using FCRM Workbench!</p>
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

    subject = f"FCRM Action Required: Case {case_id}"
    html_content = generate_email_html(event_type, case_id, detail)

    try:
        r = resend.Emails.send({
            "from": "FCRM Workbench <hello@knoatechsolutions.com>",
            "to": TO_EMAIL,
            "subject": subject,
            "html": html_content
        })
        print(f"[Email] Sent notification for {case_id} to {TO_EMAIL}")
    except Exception as e:
        print(f"[Email] Failed to send email: {e}")
