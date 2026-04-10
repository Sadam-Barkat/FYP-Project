from datetime import date as date_type, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, and_, cast, func, select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.staff import Staff
from app.models.hr import Attendance, AttendanceStatus, Shift
from app.models.user import User, UserRole
from app.models.assignments import DoctorAssignment, NurseAssignment, NursePatientAssignment
from app.models.staff_invitation import StaffInvitation
from app.models.vital import Vital
from app.models.clinical import Appointment, Visit, Prescription, TreatmentPlan
from app.models.laboratory_extra import LabRequest
from app.models.analytics import Categorization
from app.models.system import AuditLog
from app.core.websocket_manager import broadcast_admin_data_changed
from app.core.security import create_access_token, get_password_hash, SECRET_KEY, ALGORITHM
from app.schemas.hr_staff import StaffInviteRequest, StaffSignupRequest, StaffUpdateRequest
from app.utils.staff_invite_email import (
    send_staff_invitation_email,
    map_staff_type_to_user_role,
    validate_staff_invitation_token,
)
import jwt

router = APIRouter(prefix="/api", tags=["hr_staff"])


# ---------------------------------------------------------------------------
# HR & Staff overview endpoint  (existing dashboard API)
# ---------------------------------------------------------------------------
@router.get("/hr-staff-overview")
async def get_hr_staff_overview(
    date_param: Optional[date_type] = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Backend for the Admin 'HR & Staff Overview' page.

    Metrics:
    - staff_on_duty: count of staff marked present on the selected date
    - active_shifts: count of attendance records on the selected date (proxy for active shifts)
    - absent_today: count of staff absent on the selected date
    - on_leave: count of staff on leave on the selected date
    - live_staff_status: list of staff with their status for the selected date
    - attendance_trend: last 5 days of present/absent/leave counts
    """
    try:
        now = datetime.utcnow()
        base_date = date_param or now.date()
        day_start = datetime.combine(base_date, time.min)
        day_end = datetime.combine(base_date, time.max)
        five_days_ago = base_date - timedelta(days=4)

        # --- Core counts for selected date from attendance table ---
        counts_stmt = (
            select(
                Attendance.status,
                func.count(Attendance.id).label("count"),
            )
            .where(
                and_(
                    Attendance.date >= base_date,
                    Attendance.date <= base_date,
                )
            )
            .group_by(Attendance.status)
        )
        counts_result = await db.execute(counts_stmt)
        status_counts: Dict[AttendanceStatus, int] = {}
        for row in counts_result.mappings():
            att_status: AttendanceStatus = row["status"]
            count_val: int = row["count"]
            status_counts[att_status] = count_val

        staff_on_duty = status_counts.get(AttendanceStatus.present, 0)
        absent_today = status_counts.get(AttendanceStatus.absent, 0)
        on_leave = status_counts.get(AttendanceStatus.leave, 0)

        # For this dashboard, treat any recorded attendance for the day as an "active shift"
        active_shifts_stmt = (
            select(func.count(Attendance.id))
            .where(
                and_(
                    Attendance.date >= base_date,
                    Attendance.date <= base_date,
                )
            )
        )
        active_shifts_result = await db.execute(active_shifts_stmt)
        active_shifts = active_shifts_result.scalar_one() or 0

        # --- Live staff status table ---
        # Left join staff with attendance record for selected date.
        staff_with_attendance_stmt = (
            select(
                Staff.name,
                Staff.role,
                Staff.department,
                Attendance.status.label("attendance_status"),
            )
            .select_from(Staff)
            .join(
                Attendance,
                and_(
                    Attendance.staff_id == Staff.id,
                    Attendance.date == base_date,
                ),
                isouter=True,
            )
            .order_by(Staff.name)
        )
        staff_rows = await db.execute(staff_with_attendance_stmt)

        live_staff_status: List[Dict[str, Any]] = []
        for row in staff_rows.mappings():
            attendance_status: Optional[AttendanceStatus] = row["attendance_status"]
            if attendance_status == AttendanceStatus.present:
                status_label = "On Duty"
            elif attendance_status == AttendanceStatus.leave:
                status_label = "On Leave"
            elif attendance_status == AttendanceStatus.absent:
                status_label = "Absent"
            else:
                status_label = "Off Duty"

            live_staff_status.append(
                {
                    "name": row["name"],
                    "role": row["role"],
                    "department": row["department"],
                    "status": status_label,
                }
            )

        # --- Attendance trend for past 5 days (including selected date) ---
        trend_stmt = (
            select(
                cast(Attendance.date, Date).label("day"),
                Attendance.status,
                func.count(Attendance.id).label("count"),
            )
            .where(
                and_(
                    Attendance.date >= five_days_ago,
                    Attendance.date <= base_date,
                )
            )
            .group_by("day", Attendance.status)
        )
        trend_result = await db.execute(trend_stmt)

        # Build mapping: {day: {status: count}}
        trend_map: Dict[date_type, Dict[str, int]] = {}
        for row in trend_result.mappings():
            day = row["day"]
            att_status = row["status"]
            count = row["count"]
            if day not in trend_map:
                trend_map[day] = {"present": 0, "absent": 0, "leave": 0}
            if att_status == AttendanceStatus.present:
                trend_map[day]["present"] += count
            elif att_status == AttendanceStatus.absent:
                trend_map[day]["absent"] += count
            elif att_status == AttendanceStatus.leave:
                trend_map[day]["leave"] += count

        attendance_trend: List[Dict[str, Any]] = []
        for i in range(5):
            day = five_days_ago + timedelta(days=i)
            day_counts = trend_map.get(day, {"present": 0, "absent": 0, "leave": 0})
            attendance_trend.append(
                {
                    "date": day.isoformat(),
                    "present": day_counts["present"],
                    "absent": day_counts["absent"],
                    "leave": day_counts["leave"],
                }
            )

        return {
            "staff_on_duty": staff_on_duty,
            "active_shifts": int(active_shifts),
            "absent_today": absent_today,
            "on_leave": on_leave,
            "live_staff_status": live_staff_status,
            "attendance_trend": attendance_trend,
            "selected_date": base_date.isoformat(),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load HR & Staff overview: {exc}",
        )


# ---------------------------------------------------------------------------
# Staff invitation helpers (role mapping, email template, email sender)
# ---------------------------------------------------------------------------
def _map_staff_type_to_user_role(staff_type: str) -> UserRole:
    """Map UI staff type label to backend UserRole."""
    t = staff_type.strip().lower()
    if t == "doctor":
        return UserRole.doctor
    # For now, treat nurse, laboratorian, and receptionist as nurse role.
    return UserRole.nurse


def _build_staff_invite_html(signup_url: str, staff_type: str) -> str:
    safe_type = staff_type.title()
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
          <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">Staff account invitation</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="font-size:14px; margin:0 0 12px;">Dear {safe_type},</p>
          <p style="font-size:14px; margin:0 0 12px;">
            You have been invited to join the Hospital Real-Time Intelligent Dashboard as a <strong>{safe_type}</strong>.
          </p>
          <p style="font-size:14px; margin:0 0 16px;">
            To activate your staff account and complete your profile (name, age, location, contact details, etc.), please click the button below.
          </p>
          <p style="text-align:center; margin:24px 0;">
            <a href="{signup_url}" style="display:inline-block; padding:10px 22px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:999px; font-size:14px; font-weight:600;">
              Click here to complete your signup
            </a>
          </p>
          <p style="font-size:13px; margin:0 0 10px; color:#4b5563;">
            If the button does not work, copy and paste the following link into your browser:
          </p>
          <p style="font-size:12px; margin:0 0 16px; color:#6b7280; word-break:break-all;">
            {signup_url}
          </p>
          <p style="font-size:12px; margin:0; color:#6b7280;">
            This link is personal and should not be shared. For security reasons, it may expire after a short period.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px; background:#f9fafb; color:#6b7280; font-size:11px; text-align:center;">
          © {datetime.utcnow().year} Hospital Real-Time Dashboard. All rights reserved.
        </td>
      </tr>
    </table>
  </body>
</html>
"""


async def _send_resend_email(to_email: str, subject: str, html: str) -> None:
    if not RESEND_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email service not configured (RESEND_API_KEY missing).",
        )

    payload = {
        "from": "Hospital Dashboard <no-reply@example.com>",
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    body = json.dumps(payload).encode("utf-8")

    def _send() -> None:
        req = urlrequest.Request(
            "https://api.resend.com/emails",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {RESEND_API_KEY}",
            },
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=15) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"Resend API error: {resp.status}")
        except urlerror.HTTPError as e:
            raise RuntimeError(f"Resend HTTP error: {e.code} {e.reason}") from e
        except urlerror.URLError as e:
            raise RuntimeError(f"Resend connection error: {e.reason}") from e

    await asyncio.to_thread(_send)


# ---------------------------------------------------------------------------
# Staff invitation endpoints (User Management - Staff tab)
# ---------------------------------------------------------------------------
@router.post("/user-management/staff/invite")
async def invite_staff(
    payload: StaffInviteRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Invite a staff member by email.

    - Admin provides only email + staff_type (Doctor/Nurse/Laboratorian/Receptionist).
    - Backend generates a signed token and sends a Resend email containing a private signup link.
    - Staff will complete their profile on that signup page.
    """
    try:
        email_clean = (payload.email or "").strip().lower()
        if not email_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required.",
            )

        # Reject if this email is already a registered user (any role)
        existing_user = await db.execute(select(User).where(func.lower(User.email) == email_clean))
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already registered as a staff member. Each email can only be used for one role.",
            )

        # Reject if this email was already invited (pending signup)
        existing_invite = await db.execute(select(StaffInvitation).where(StaffInvitation.email_lower == email_clean))
        if existing_invite.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email has already been sent an invitation. Each email can only be used for one role.",
            )

        # Record the invitation so the same email cannot be invited again
        inv = StaffInvitation(email_lower=email_clean, staff_type=payload.staff_type)
        db.add(inv)
        await db.commit()
        await broadcast_admin_data_changed("staff_invite")

        # Generate token, build signup URL, and send email
        token, signup_url = await send_staff_invitation_email(
            email=payload.email,
            staff_type=payload.staff_type,
        )

        return {
            "message": "Invitation email sent.",
            "email": payload.email,
            "staff_type": payload.staff_type,
            "signup_url": signup_url,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send staff invitation: {exc}",
        )


@router.get("/user-management/staff")
async def get_user_management_staff(
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Return all non-admin staff for the User Management page.

    - Skips users with admin role so the admin account cannot be deleted.
    - Uses User as the source of email + role.
    - Attempts to enrich with Staff profile data (age/phone/address/role) by
      matching on full name where available.
    - Includes active patient counts for doctors and nurses.
    """
    try:
        # Base users: all non-admin accounts
        users_stmt = select(User).where(User.role != UserRole.admin).order_by(User.id)
        users_result = await db.execute(users_stmt)
        users: List[User] = list(users_result.scalars())

        # Build a simple map of Staff profiles keyed by full name, so that
        # we can attach age/phone/address/role when names match.
        staff_stmt = select(Staff)
        staff_result = await db.execute(staff_stmt)
        staff_profiles: Dict[str, Staff] = {}
        for s in staff_result.scalars():
            key = (s.name or "").strip().lower()
            if key:
                staff_profiles[key] = s

        response: List[Dict[str, Any]] = []
        for u in users:
            full_name = f"{u.first_name} {u.last_name}".strip()
            profile = staff_profiles.get(full_name.lower())
            # Decide UI staff type. Prefer Staff.role from profile if present.
            if profile and profile.role in {"Doctor", "Nurse", "Laboratorian", "Receptionist"}:
                staff_type = profile.role
            elif u.role == UserRole.doctor:
                staff_type = "Doctor"
            else:
                # Default to Nurse for any non-admin, non-doctor roles.
                staff_type = "Nurse"

            # Active patient counts for doctors and nurses
            active_patients = 0
            if staff_type == "Doctor":
                count_stmt = select(func.count(DoctorAssignment.id)).where(
                    DoctorAssignment.doctor_id == u.id,
                    DoctorAssignment.status == "active",
                )
                count_result = await db.execute(count_stmt)
                active_patients = int(count_result.scalar_one() or 0)
            elif staff_type == "Nurse":
                count_stmt = select(func.count(NursePatientAssignment.id)).where(
                    NursePatientAssignment.nurse_id == u.id,
                    NursePatientAssignment.status == "active",
                )
                count_result = await db.execute(count_stmt)
                active_patients = int(count_result.scalar_one() or 0)

            response.append(
                {
                    "id": u.id,
                    "email": u.email,
                    "staff_type": staff_type,
                    "name": full_name or None,
                    "age": getattr(profile, "age", None) if profile else None,
                    "phone": getattr(profile, "phone", None) if profile else None,
                    "address": getattr(profile, "address", None) if profile else None,
                    "gender": None,
                    "department": getattr(profile, "department", None) if profile else None,
                    "active_patients": active_patients,
                }
            )

        return response
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load staff list: {exc}",
        )


@router.patch("/user-management/staff/{user_id}")
async def update_user_management_staff_member(
    user_id: int,
    payload: StaffUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Update a staff member's profile (email, name, age, phone, address, department).
    Role cannot be changed.
    """
    try:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user: Optional[User] = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")
        if user.role == UserRole.admin:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot update admin.")

        old_full_name = f"{user.first_name} {user.last_name}".strip()

        if payload.email is not None:
            user.email = payload.email.strip()
        if payload.first_name is not None:
            user.first_name = payload.first_name.strip()
        if payload.last_name is not None:
            user.last_name = payload.last_name.strip()

        new_full_name = f"{user.first_name} {user.last_name}".strip()

        # Update matching Staff profile(s) by old name
        staff_result = await db.execute(select(Staff).where(Staff.name == old_full_name))
        for staff in staff_result.scalars():
            if payload.age is not None:
                staff.age = payload.age
            if payload.phone is not None:
                staff.phone = payload.phone.strip() or None
            if payload.address is not None:
                staff.address = payload.address.strip() or None
            if payload.department is not None:
                staff.department = payload.department.strip()
            if new_full_name and new_full_name != old_full_name:
                staff.name = new_full_name

        await db.commit()
        await broadcast_admin_data_changed("staff_update")
        return {"message": "Staff updated.", "user_id": user_id}
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update staff: {exc}",
        )


@router.delete("/user-management/staff/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_management_staff_member(
    user_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a staff member (User + matching Staff profile) from User Management.

    - Only affects non-admin users; attempts to delete an admin are rejected.
    - Doctors and nurses with active patients assigned cannot be deleted.
    - There must always be at least one Receptionist and one Laboratorian.
    - Otherwise removes related attendance/shift rows, assignments, then Staff profile(s), then User.
    """
    try:
        # Load the user
        user_result = await db.execute(select(User).where(User.id == user_id))
        user: Optional[User] = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found.")

        if user.role == UserRole.admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin user cannot be deleted from User Management.",
            )

        full_name = f"{user.first_name} {user.last_name}".strip()

        # Find matching Staff profile(s) by name
        staff_ids: List[int] = []
        staff_roles: List[str] = []
        if full_name:
            staff_result = await db.execute(select(Staff.id, Staff.role).where(Staff.name == full_name))
            for row in staff_result.all():
                staff_ids.append(row[0])
                staff_roles.append(row[1])

        # Determine effective staff_type based on Staff.role (if present) or user.role
        # This decides which validation rules apply.
        primary_role = staff_roles[0] if staff_roles else None
        if primary_role in {"Doctor", "Nurse", "Laboratorian", "Receptionist"}:
            staff_type = primary_role
        elif user.role == UserRole.doctor:
            staff_type = "Doctor"
        else:
            staff_type = "Nurse"

        # --- Validation: prevent deleting doctors/nurses with active patients ---
        if staff_type == "Doctor":
            count_stmt = select(func.count(DoctorAssignment.id)).where(
                DoctorAssignment.doctor_id == user.id,
                DoctorAssignment.status == "active",
            )
            count_result = await db.execute(count_stmt)
            active_count = int(count_result.scalar_one() or 0)
            if active_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"This doctor currently has {active_count} active patients and cannot be deleted.",
                )
        elif staff_type == "Nurse":
            count_stmt = select(func.count(NursePatientAssignment.id)).where(
                NursePatientAssignment.nurse_id == user.id,
                NursePatientAssignment.status == "active",
            )
            count_result = await db.execute(count_stmt)
            active_count = int(count_result.scalar_one() or 0)
            if active_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"This nurse currently has {active_count} active patients and cannot be deleted.",
                )

        # --- Validation: always keep at least one Receptionist and one Laboratorian ---
        if staff_type in {"Receptionist", "Laboratorian"}:
            total_stmt = select(func.count(Staff.id)).where(Staff.role == staff_type)
            total_result = await db.execute(total_stmt)
            total_with_role = int(total_result.scalar_one() or 0)
            if total_with_role <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "You must add a new Receptionist before deleting the existing one."
                        if staff_type == "Receptionist"
                        else "You must add a new Laboratory staff member before deleting the existing one."
                    ),
                )

        # Delete dependent rows first to satisfy foreign keys
        if staff_ids:
            await db.execute(delete(Attendance).where(Attendance.staff_id.in_(staff_ids)))
            await db.execute(delete(Shift).where(Shift.staff_id.in_(staff_ids)))
            await db.execute(delete(Staff).where(Staff.id.in_(staff_ids)))

        # Delete all doctor assignments (historical) now that there are no active ones
        await db.execute(delete(DoctorAssignment).where(DoctorAssignment.doctor_id == user.id))
        # Delete all nurse-patient assignments (historical) for this user
        await db.execute(delete(NursePatientAssignment).where(NursePatientAssignment.nurse_id == user.id))
        # Delete nurse (ward) assignments
        await db.execute(delete(NurseAssignment).where(NurseAssignment.nurse_id == user.id))

        # Delete or null out all other records that reference this user (foreign keys to users.id)
        await db.execute(delete(Vital).where(Vital.recorded_by == user.id))
        await db.execute(delete(Appointment).where(Appointment.doctor_id == user.id))
        await db.execute(delete(Visit).where(Visit.doctor_id == user.id))
        await db.execute(delete(Prescription).where(Prescription.doctor_id == user.id))
        await db.execute(delete(TreatmentPlan).where(TreatmentPlan.doctor_id == user.id))
        await db.execute(delete(LabRequest).where(LabRequest.doctor_id == user.id))
        await db.execute(update(Categorization).where(Categorization.categorized_by == user.id).values(categorized_by=None))
        await db.execute(update(AuditLog).where(AuditLog.user_id == user.id).values(user_id=None))

        # Delete the User record
        await db.execute(delete(User).where(User.id == user_id))

        await db.commit()
        await broadcast_admin_data_changed("staff_delete")
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete staff member: {exc}",
        )


@router.get("/staff-invitations/validate")
async def validate_staff_invitation(token: str) -> Dict[str, Any]:
    """
    Validate a staff invitation token and return minimal info for the signup page.
    """
    email, staff_type = validate_staff_invitation_token(token)
    return {"email": email, "staff_type": staff_type}


@router.post("/staff-invitations/complete")
async def complete_staff_signup(
    body: StaffSignupRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Complete staff signup using the invitation token.

    Creates a User row and a Staff row populated with profile information.
    """
    try:
        email, staff_type = validate_staff_invitation_token(body.token)

        # Ensure user does not already exist
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists.")

        user_role = _map_staff_type_to_user_role(staff_type)

        # Create User
        hashed_pw = get_password_hash(body.password)
        user = User(
            email=email,
            hashed_password=hashed_pw,
            role=user_role,
            first_name=body.first_name,
            last_name=body.last_name,
            is_active=True,
        )
        db.add(user)

        # Create Staff profile entry
        staff = Staff(
            name=f"{body.first_name} {body.last_name}",
            role=staff_type,
            department=body.department,
            shift_start=None,
            shift_end=None,
            age=body.age,
            phone=body.phone,
            address=body.address,
        )
        db.add(staff)

        # Remove pending invitation so this email is no longer blocked
        await db.execute(delete(StaffInvitation).where(StaffInvitation.email_lower == email.strip().lower()))

        await db.commit()
        await broadcast_admin_data_changed("staff_signup")
        return {
            "message": "Staff signup completed.",
            "email": email,
            "staff_type": staff_type,
            "user_role": user_role.value,
        }
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete staff signup: {exc}",
        )


