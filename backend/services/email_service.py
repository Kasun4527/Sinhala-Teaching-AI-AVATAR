import os
import smtplib
import socket
import secrets
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from db import email_tokens_collection

from dotenv import load_dotenv
load_dotenv(override=True)

GMAIL_USER     = os.getenv("GMAIL_USER")
GMAIL_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
FRONTEND_URL   = os.getenv("FRONTEND_URL", "http://localhost:3000")
TOKEN_EXPIRY_HOURS = 24

print(f"[EmailService] GMAIL_USER={GMAIL_USER!r}  PASSWORD_LEN={len(GMAIL_PASSWORD.replace(' ','')) if GMAIL_PASSWORD else 0}")


class _SMTP_IPv4(smtplib.SMTP):
    """Some cloud hosts (e.g. DigitalOcean droplets) have an IPv6 address
    assigned but no working IPv6 route. smtp.gmail.com resolves to both
    A and AAAA records, and the default dual-stack lookup can pick the
    AAAA record first and fail with "Network is unreachable". Forcing
    IPv4 here sidesteps that regardless of the host's network config.
    """
    def _get_socket(self, host, port, timeout):
        if self.debuglevel > 0:
            self._print_debug('connect:', (host, port))
        ipv4_addr = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)[0][4]
        return socket.create_connection(ipv4_addr, timeout, self.source_address)


def _send_email(to_email: str, subject: str, html_body: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"IDS Platform <{GMAIL_USER}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html_body, "html"))

    # Strip spaces from App Password in case it was copied with spaces (xxxx xxxx xxxx xxxx)
    password = (GMAIL_PASSWORD or "").replace(" ", "")

    with _SMTP_IPv4("smtp.gmail.com", 587) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(GMAIL_USER, password)
        server.sendmail(GMAIL_USER, to_email, msg.as_string())


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
