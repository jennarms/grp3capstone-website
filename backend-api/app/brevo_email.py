# app/brevo_email.py
import os
import requests

BREVO_API_KEY = os.environ.get("BREVO_API_KEY")
BREVO_SENDER_EMAIL = os.environ.get("BREVO_SENDER_EMAIL") or os.environ.get("MAIL_DEFAULT_SENDER")


def send_email(to_email: str, subject: str, text_body: str, html_body: str | None = None):
    """
    Send a simple email via Brevo HTTP API.
    This avoids SMTP and works on Render free tier.
    """
    if not BREVO_API_KEY:
        raise RuntimeError("BREVO_API_KEY is not set in environment")
    if not BREVO_SENDER_EMAIL:
        raise RuntimeError("BREVO_SENDER_EMAIL (or MAIL_DEFAULT_SENDER) is not set in environment")

    payload = {
        "sender": {"email": BREVO_SENDER_EMAIL},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": text_body,
    }

    if html_body:
        payload["htmlContent"] = html_body

    response = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        json=payload,
        headers={
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        timeout=10,
    )
    # Raise error if 4xx / 5xx
    response.raise_for_status()
    return response.json()
