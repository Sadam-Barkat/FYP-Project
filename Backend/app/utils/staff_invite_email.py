import os
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import timedelta
from typing import Tuple

from fastapi import HTTPException, status

from app.models.user import UserRole
from app.core.security import create_access_token, SECRET_KEY, ALGORITHM
import jwt

DEFAULT_FRONTEND_BASE_URL = "https://fyp-project-qc9he0lkr-sadam-barkats-projects.vercel.app"
# Allow either var name (Railway/Render envs vary). FRONTEND_BASE_URL wins if valid.
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL") or os.getenv("PUBLIC_FRONTEND_URL") or DEFAULT_FRONTEND_BASE_URL


def _get_frontend_base_url() -> str:
    """
    Decide which frontend base URL to use for emails.
    In deployments, people often accidentally keep FRONTEND_BASE_URL=localhost,
    which makes emailed links unusable. If we detect localhost, we fallback.
    """
    base = (FRONTEND_BASE_URL or "").strip().rstrip("/")
    if not base:
        return DEFAULT_FRONTEND_BASE_URL
    if "localhost" in base or base.startswith("http://127.0.0.1"):
        return DEFAULT_FRONTEND_BASE_URL
    if base.endswith("/api"):
        base = base[:-4]
    return base

# Gmail SMTP (from env)
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int((os.getenv("SMTP_PORT") or "587"))
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "Real-Time-inteligence-dashboard")


def map_staff_type_to_user_role(staff_type: str) -> UserRole:
    """Map UI staff type label to backend UserRole."""
    t = staff_type.strip().lower()
    if t == "doctor":
        return UserRole.doctor
    return UserRole.nurse


def _build_staff_invite_html(signup_url: str, staff_type: str) -> str:
    """Build HTML body for invitation email. Uses staff_type as greeting (e.g. Doctor, Nurse)."""
    greeting = staff_type.title()
    return f"""
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Staff Account Invitation</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color:#f4f7fa; padding:24px; color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(15,23,42,0.08);">
      <tr>
        <td style="padding:20px 24px; background:#0f766e; color:#fff;">
          <h1 style="margin:0; font-size:20px;">Hospital Real-Time Dashboard</h1>
          <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">You are invited to join</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="font-size:14px; margin:0 0 12px;">Hello {greeting},</p>
          <p style="font-size:14px; margin:0 0 12px;">
            You have been added to the Hospital Dashboard system. To complete your account setup, please click the link below to create your password and access your account:
          </p>
          <p style="text-align:center; margin:24px 0;">
            <a href="{signup_url}" style="display:inline-block; padding:10px 22px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:999px; font-size:14px; font-weight:600;">
              Complete your signup
            </a>
          </p>
          <p style="font-size:12px; margin:0 0 10px; color:#6b7280; word-break:break-all;">
            {signup_url}
          </p>
          <p style="font-size:14px; margin:0 0 12px;">
            If you did not expect this email, please ignore it.
          </p>
          <p style="font-size:14px; margin:0;">
            Best regards,<br />
            Hospital Dashboard Team
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px; background:#f9fafb; color:#6b7280; font-size:11px; text-align:center;">
          © Hospital Dashboard. All rights reserved.
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _send_smtp_sync(to_email: str, subject: str, html_body: str) -> None:
    """Send email via Gmail SMTP. Runs in thread; raises RuntimeError on missing config or SMTP error."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        raise RuntimeError("Email not configured. Set SMTP_EMAIL and SMTP_PASSWORD in .env")
    # Gmail App Passwords are 16 chars; they're often shown/pasted with spaces (e.g. "abcd efgh ijkl mnop") — strip for login
    password = (SMTP_PASSWORD or "").replace(" ", "").strip()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{EMAIL_FROM_NAME} <{SMTP_EMAIL}>"
    msg["Reply-To"] = SMTP_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.starttls()
            smtp.login(SMTP_EMAIL, password)
            smtp.sendmail(SMTP_EMAIL, [to_email], msg.as_string())
    except smtplib.SMTPException as e:
        raise RuntimeError(f"SMTP error: {e}") from e


async def _send_smtp_email(to_email: str, subject: str, html: str) -> None:
    """Send email via SMTP in a thread to avoid blocking."""
    try:
        await asyncio.to_thread(_send_smtp_sync, to_email, subject, html)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e


async def send_staff_invitation_email(email: str, staff_type: str) -> Tuple[str, str]:
    """
    Generate an invitation token + signup URL, send the invitation email via Gmail SMTP,
    and return (token, signup_url).
    """
    expires = timedelta(days=7)
    token = create_access_token(
        data={
            "sub": email,
            "invite_for": "staff_signup",
            "staff_type": staff_type,
        },
        expires_delta=expires,
    )
    base = _get_frontend_base_url()
    signup_url = f"{base}/staff-signup?token={token}"

    html = _build_staff_invite_html(signup_url, staff_type)
    subject = "You are invited to join the Hospital Dashboard"
    await _send_smtp_email(to_email=email, subject=subject, html=html)
    return token, signup_url


def validate_staff_invitation_token(token: str) -> Tuple[str, str]:
    """
    Decode and validate a staff invitation token.
    Returns (email, staff_type) if valid, raises HTTPException otherwise.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("invite_for") != "staff_signup":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invitation token.")
        email = payload.get("sub")
        staff_type = payload.get("staff_type")
        if not email or not staff_type:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invitation payload.")
        return email, staff_type
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invitation link has expired.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invitation token.")
