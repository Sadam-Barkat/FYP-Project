"""
Notify assigned doctor/nurse when a receptionist registers a new patient.

Uses the same SMTP env configuration pattern as other emails in this project:
- SMTP_EMAIL, SMTP_PASSWORD, SMTP_HOST, SMTP_PORT

The email includes a link to the frontend login page so the recipient can sign in quickly.
"""

import os
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

DEFAULT_FRONTEND_BASE_URL = "https://fyp-project-livid.vercel.app"
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL") or os.getenv("PUBLIC_FRONTEND_URL") or DEFAULT_FRONTEND_BASE_URL

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int((os.getenv("SMTP_PORT") or "587"))


def _get_frontend_base_url() -> str:
    base = (FRONTEND_BASE_URL or "").strip().rstrip("/")
    if not base:
        return DEFAULT_FRONTEND_BASE_URL
    if "localhost" in base or base.startswith("http://127.0.0.1"):
        return DEFAULT_FRONTEND_BASE_URL
    if base.endswith("/api"):
        base = base[:-4]
    return base


def _build_patient_assignment_html(
    recipient_name: str,
    recipient_role_label: str,
    patient_name: str,
    patient_age: int,
    patient_gender: str,
    patient_blood_group: Optional[str],
    patient_contact: Optional[str],
    patient_address: Optional[str],
    login_url: str,
) -> str:
    blood = patient_blood_group or "—"
    contact = patient_contact or "—"
    address = patient_address or "—"

    safe_recipient = (recipient_name or recipient_role_label or "Staff").strip() or "Staff"
    safe_role = (recipient_role_label or "Staff").strip() or "Staff"

    return f"""
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>New Patient Assigned</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color:#f4f7fa; padding:24px; color:#111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 10px rgba(15,23,42,0.08);">
      <tr>
        <td style="padding:18px 22px; background:#0066cc; color:#fff;">
          <h1 style="margin:0; font-size:18px;">Real Time Intelligent Dashboard</h1>
          <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">New patient assignment</p>
        </td>
      </tr>
      <tr>
        <td style="padding:22px;">
          <p style="font-size:14px; margin:0 0 10px;">Hello {safe_recipient},</p>
          <p style="font-size:14px; margin:0 0 14px;">
            A receptionist has registered a new patient and assigned them to you as a <strong>{safe_role}</strong>.
          </p>

          <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 14px; background:#f9fafb;">
            <p style="margin:0 0 10px; font-size:13px; color:#374151; font-weight:700;">Patient details</p>
            <table cellpadding="0" cellspacing="0" style="width:100%; font-size:13px; color:#111827;">
              <tr><td style="padding:4px 0; width:140px; color:#6b7280;">Name</td><td style="padding:4px 0; font-weight:600;">{patient_name}</td></tr>
              <tr><td style="padding:4px 0; color:#6b7280;">Age</td><td style="padding:4px 0;">{patient_age}</td></tr>
              <tr><td style="padding:4px 0; color:#6b7280;">Gender</td><td style="padding:4px 0;">{patient_gender}</td></tr>
              <tr><td style="padding:4px 0; color:#6b7280;">Blood group</td><td style="padding:4px 0;">{blood}</td></tr>
              <tr><td style="padding:4px 0; color:#6b7280;">Contact</td><td style="padding:4px 0;">{contact}</td></tr>
              <tr><td style="padding:4px 0; color:#6b7280;">Address</td><td style="padding:4px 0;">{address}</td></tr>
            </table>
          </div>

          <p style="font-size:13px; margin:16px 0 10px; color:#374151;">
            Click below to open the dashboard and sign in:
          </p>
          <p style="text-align:center; margin:18px 0;">
            <a href="{login_url}" style="display:inline-block; padding:11px 20px; background:#0066cc; color:#ffffff; text-decoration:none; border-radius:999px; font-size:14px; font-weight:700;">
              Go to Login
            </a>
          </p>
          <p style="font-size:12px; margin:0; color:#6b7280; word-break:break-all;">
            If the button doesn't work, copy and paste this link: {login_url}
          </p>

          <p style="font-size:13px; margin:18px 0 0; color:#6b7280;">
            If you were not expecting this assignment, please contact the admin.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 22px; background:#f9fafb; color:#6b7280; font-size:11px; text-align:center;">
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
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
        smtp.starttls()
        smtp.login(SMTP_EMAIL, password)
        smtp.sendmail(SMTP_EMAIL, [to_email], msg.as_string())


async def send_patient_assignment_email(
    *,
    to_email: str,
    recipient_name: str,
    recipient_role_label: str,
    patient_name: str,
    patient_age: int,
    patient_gender: str,
    patient_blood_group: Optional[str],
    patient_contact: Optional[str],
    patient_address: Optional[str],
) -> None:
    """
    Send assignment email. Raises RuntimeError if SMTP is not configured or email send fails.
    Caller should catch exceptions to avoid breaking primary flows.
    """
    base = _get_frontend_base_url()
    login_url = f"{base}/login"
    subject = f"New patient assigned: {patient_name}"
    html = _build_patient_assignment_html(
        recipient_name=recipient_name,
        recipient_role_label=recipient_role_label,
        patient_name=patient_name,
        patient_age=patient_age,
        patient_gender=patient_gender,
        patient_blood_group=patient_blood_group,
        patient_contact=patient_contact,
        patient_address=patient_address,
        login_url=login_url,
    )
    await asyncio.to_thread(_send_smtp_sync, to_email.strip(), subject, html)

