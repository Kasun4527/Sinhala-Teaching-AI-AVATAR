import os
import secrets
import requests
from datetime import datetime, timedelta
from db import email_tokens_collection

from dotenv import load_dotenv
load_dotenv(override=True)

GMAIL_USER        = os.getenv("GMAIL_USER")
BREVO_API_KEY     = os.getenv("BREVO_API_KEY")
FRONTEND_URL      = os.getenv("FRONTEND_URL", "http://localhost:3000")
TOKEN_EXPIRY_HOURS = 24

print(f"[EmailService] GMAIL_USER={GMAIL_USER!r}  BREVO_API_KEY_SET={bool(BREVO_API_KEY)}")


def _send_email(to_email: str, subject: str, html_body: str):
    # Sent via Brevo's HTTPS API (port 443) instead of raw SMTP — some hosts
    # (e.g. DigitalOcean droplets) block outbound SMTP ports 25/465/587 entirely
    # at the platform level, which HTTPS traffic isn't subject to.
    resp = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={
            "sender": {"name": "IDS Platform", "email": GMAIL_USER},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_body,
        },
        timeout=15,
    )
    resp.raise_for_status()


def create_verification_token(email: str) -> str:
    # Remove any existing token for this email first
    email_tokens_collection.delete_many({"email": email})

    token = secrets.token_urlsafe(32)
    email_tokens_collection.insert_one({
        "email":      email,
        "token":      token,
        "expires_at": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS),
        "used":       False,
    })
    return token


def send_verification_email(email: str, name: str):
    token = create_verification_token(email)
    verify_url = f"{FRONTEND_URL}/verify-email?token={token}"
    print(f"[EmailService] Sending verification email TO: {email}  URL: {verify_url}")

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#0f172a,#1e3a8a);padding:36px 40px;">
          <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;">
            <div style="background:#2563eb;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-weight:700;font-size:11px;">IDS</span>
            </div>
            <span style="color:white;font-weight:600;font-size:14px;">IDS Platform</span>
          </div>
          <h1 style="color:white;margin:0;font-size:26px;font-weight:700;">Verify your email</h1>
          <p style="color:rgba(255,255,255,0.6);margin:8px 0 0;font-size:14px;">One click to activate your account</p>
        </div>
        <div style="padding:36px 40px;">
          <p style="color:#334155;font-size:15px;margin:0 0 8px;">Hi <strong>{name}</strong>,</p>
          <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 28px;">
            Thanks for signing up for IDS Platform. Please verify your email address to activate your account and start learning.
          </p>
          <a href="{verify_url}"
             style="display:inline-block;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:white;
                    text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;
                    font-size:15px;letter-spacing:0.01em;">
            Verify Email Address →
          </a>
          <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;line-height:1.7;">
            This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.<br><br>
            Or copy this link into your browser:<br>
            <span style="color:#2563eb;word-break:break-all;">{verify_url}</span>
          </p>
        </div>
        <div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
            © 2025 IDS Platform · AI-Powered Adaptive Learning
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    _send_email(email, "Verify your IDS Platform account", html)


def verify_token(token: str) -> str | None:
    """Returns the email if token is valid and unused, else None."""
    record = email_tokens_collection.find_one({"token": token, "used": False})
    if not record:
        return None
    if datetime.utcnow() > record["expires_at"]:
        return None
    # Mark as used
    email_tokens_collection.update_one({"token": token}, {"$set": {"used": True}})
    return record["email"]
