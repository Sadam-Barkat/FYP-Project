"""
Password reset email: template and send via Gmail SMTP.
Reuses SMTP config from staff_invite_email; adds password-reset-specific template and token validation.
"""
import os
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import timedelta
from typing import Tuple

from fastapi import HTTPException, status
import jwt

from app.core.security import create_access_token, SECRET_KEY, ALGORITHM

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "https://fyp-project-livid.vercel.app")
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int((os.getenv("SMTP_PORT") or "587"))


def _build_password_reset_html(reset_url: str) -> str:
    """Professional HTML email template for password reset."""
    return f"""
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Reset Your Password</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color:#f4f7fa; padding:24px; color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(15,23,42,0.08);">
      <tr>
        <td style="padding:20px 24px; background:#0066cc; color:#fff;">
          <h1 style="margin:0; font-size:20px;">Real Time Intelligent Dashboard</h1>
          <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">Password reset request</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="font-size:14px; margin:0 0 12px;">Hello,</p>
          <p style="font-size:14px; margin:0 0 12px;">
            We received a request to reset the password for your account. Click the button below to choose a new password:
          </p>
          <p style="text-align:center; margin:24px 0;">
            <a href="{reset_url}" style="display:inline-block; padding:12px 24px; background:#0066cc; color:#ffffff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600;">
              Reset password
            </a>
          </p>
          <p style="font-size:12px; margin:0 0 10px; color:#6b7280; word-break:break-all;">
            Or copy this link: {reset_url}
          </p>
          <p style="font-size:13px; margin:16px 0 0; color:#6b7280;">
            This link will expire in 1 hour. If you did not request a password reset, please ignore this email or contact support if you have concerns.
          </p>
          <p style="font-size:14px; margin:24px 0 0;">
            Best regards,<br />
            Hospital Dashboard Team
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px; background:#f9fafb; color:#6b7280; font-size:11px; text-align:center;">
          © Real Time Intelligent Dashboard. All rights reserved.
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _send_smtp_sync(to_email: str, subject: str, html_body: str) -> None:
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        raise RuntimeError("Email not configured. Set SMTP_EMAIL and SMTP_PASSWORD in .env")
    password = (SMTP_PASSWORD or "").replace(" ", "").strip()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_EMAIL
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
    try:
        await asyncio.to_thread(_send_smtp_sync, to_email, subject, html)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e


async def send_password_reset_email(email: str) -> str:
    """
    Create a password-reset JWT and send the reset email. Returns the token (for testing).
    Token expires in 1 hour.
    """
    expires = timedelta(hours=1)
    token = create_access_token(
        data={
            "sub": email.strip().lower(),
            "purpose": "password_reset",
        },
        expires_delta=expires,
    )
    base = FRONTEND_BASE_URL.rstrip("/")
    if base.endswith("/api"):
        base = base[:-4]
    reset_url = f"{base}/reset-password?token={token}"
    html = _build_password_reset_html(reset_url)
    subject = "Reset your password – Real Time Intelligent Dashboard"
    await _send_smtp_email(to_email=email.strip(), subject=subject, html=html)
    return token


def validate_password_reset_token(token: str) -> str:
    """Decode and validate password reset token. Returns email if valid. Raises HTTPException otherwise."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "password_reset":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link has expired. Please request a new one.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token.")
