"""
PDF export: generate page-specific reports from backend data.
Export from any admin page produces a PDF for that page's data.
"""
from datetime import date, datetime
from io import BytesIO
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/export", tags=["export"])

# Import data fetchers
from app.api.routers.overview import get_hospital_overview
from app.api.routers.patients_beds import get_patients_beds_overview
from app.api.routers.pharmacy import get_pharmacy_overview
from app.api.routers.laboratory import get_laboratory_overview
from app.api.routers.billing_finance import get_billing_finance_overview
from app.api.routers.hr_staff import get_hr_staff_overview
from app.api.routers.alerts_overview import get_alerts_overview
from app.api.routers.analytics_forecasts import get_analytics_forecasts


def _table_style_header():
    return [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]


def _build_pdf(story: List) -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )
    doc.build(story)
    buffer.seek(0)
    return buffer


def _make_story(title: str, report_date: date) -> tuple:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Heading1"], fontSize=18, spaceAfter=6
    )
    heading_style = styles["Heading2"]
    body_style = styles["Normal"]
    story = []
    story.append(Paragraph(title, title_style))
    story.append(Paragraph(f"Date: {report_date.isoformat()}", body_style))
    story.append(Spacer(1, 8 * mm))
    return story, heading_style, body_style


def _build_overview_pdf(data: Dict[str, Any], report_date: date) -> BytesIO:
    story, heading_style, _ = _make_story("Hospital Overview Report", report_date)
    ap = data.get("active_patients") or {}
    metrics_data = [
        ["Metric", "Value"],
        ["Total beds", str(data.get("total_beds", 0))],
        ["Active patients (total)", str(ap.get("total", 0))],
        ["ICU", str(ap.get("icu", 0))],
        ["Emergency", str(ap.get("emergency", 0))],
        ["General ward", str(ap.get("general_ward", 0))],
        ["Cardiology", str(ap.get("cardiology", 0))],
        ["Today's revenue", f"{data.get('todays_revenue', 0):,.2f}"],
        ["Doctors on duty", str(data.get("doctors_on_duty", 0))],
        ["Emergency cases", str(data.get("emergency_cases", 0))],
        ["ICU occupancy %", f"{data.get('icu_occupancy', 0):.1f}%"],
    ]
    t1 = Table(metrics_data, colWidths=[100 * mm, 70 * mm])
    t1.setStyle(TableStyle(_table_style_header() + [("BACKGROUND", (0, 1), (-1, -1), colors.beige)]))
    story.append(Paragraph("Key metrics", heading_style))
    story.append(Spacer(1, 3 * mm))
    story.append(t1)
    trend = data.get("admission_trend") or []
    if trend:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Admission trend (7 days)", heading_style))
        story.append(Spacer(1, 3 * mm))
        trend_data = [["Date", "Admissions"]] + [[r.get("date", ""), str(r.get("admissions", 0))] for r in trend]
        t2 = Table(trend_data, colWidths=[60 * mm, 50 * mm])
        t2.setStyle(TableStyle(_table_style_header()))
        story.append(t2)
    deps = data.get("bed_occupancy_by_department") or []
    if deps:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Bed occupancy by department", heading_style))
        story.append(Spacer(1, 3 * mm))
        dep_data = [["Department", "Occupied", "Total"]]
        for row in deps:
            dep_data.append([row.get("department", ""), str(row.get("occupied", 0)), str(row.get("total", 0))])
        t3 = Table(dep_data, colWidths=[60 * mm, 35 * mm, 35 * mm])
        t3.setStyle(TableStyle(_table_style_header()))
        story.append(t3)
    return _build_pdf(story)


def _build_patients_beds_pdf(data: Dict[str, Any], report_date: date) -> BytesIO:
    story, heading_style, _ = _make_story("Patients & Beds Report", report_date)
    metrics = [
        ["Metric", "Value"],
        ["Total capacity", str(data.get("total_capacity", 0))],
        ["Occupied beds", str(data.get("occupied_beds", 0))],
        ["Available beds", str(data.get("available_beds", 0))],
        ["Occupancy %", f"{data.get('occupancy_percentage', 0):.1f}%"],
        ["Emergency cases", str(data.get("emergency_cases", 0))],
    ]
    t1 = Table(metrics, colWidths=[80 * mm, 60 * mm])
    t1.setStyle(TableStyle(_table_style_header() + [("BACKGROUND", (0, 1), (-1, -1), colors.beige)]))
    story.append(Paragraph("Capacity", heading_style))
    story.append(Spacer(1, 3 * mm))
    story.append(t1)
    deps = data.get("bed_occupancy_by_department") or []
    if deps:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Bed occupancy by department", heading_style))
        story.append(Spacer(1, 3 * mm))
        dep_data = [["Department", "Occupied", "Total"]]
        for row in deps:
            dep_data.append([row.get("department", ""), str(row.get("occupied", 0)), str(row.get("total", 0))])
        t2 = Table(dep_data, colWidths=[60 * mm, 35 * mm, 35 * mm])
        t2.setStyle(TableStyle(_table_style_header()))
        story.append(t2)
    trend = data.get("admissions_discharges_trend") or []
    if trend:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Admissions vs discharges (7 days)", heading_style))
        story.append(Spacer(1, 3 * mm))
        tr_data = [["Day", "Admissions", "Discharges"]]
        for row in trend:
            tr_data.append([row.get("day", ""), str(row.get("admissions", 0)), str(row.get("discharges", 0))])
        t3 = Table(tr_data, colWidths=[40 * mm, 45 * mm, 45 * mm])
        t3.setStyle(TableStyle(_table_style_header()))
        story.append(t3)
    return _build_pdf(story)


def _build_pharmacy_pdf(data: Dict[str, Any], report_date: date) -> BytesIO:
    story, heading_style, _ = _make_story("Pharmacy Overview Report", report_date)
    metrics = [
        ["Metric", "Value"],
        ["Total medicines", str(data.get("total_medicines", 0))],
        ["Low stock items", str(data.get("low_stock_items", 0))],
        ["Expiring soon (30d)", str(data.get("expiring_soon", 0))],
        ["Total stock value", f"{data.get('total_stock_value', 0):,.2f}"],
    ]
    t1 = Table(metrics, colWidths=[80 * mm, 60 * mm])
    t1.setStyle(TableStyle(_table_style_header() + [("BACKGROUND", (0, 1), (-1, -1), colors.beige)]))
    story.append(Paragraph("Summary", heading_style))
    story.append(Spacer(1, 3 * mm))
    story.append(t1)
    cats = data.get("stock_level_by_category") or []
    if cats:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Stock by category", heading_style))
        story.append(Spacer(1, 3 * mm))
        cat_data = [["Category", "Stock value", "%"]]
        for row in cats:
            cat_data.append([row.get("category", ""), f"{row.get('stock_value', 0):,.2f}", f"{row.get('percentage', 0):.1f}%"])
        t2 = Table(cat_data, colWidths=[70 * mm, 45 * mm, 35 * mm])
        t2.setStyle(TableStyle(_table_style_header()))
        story.append(t2)
    low = data.get("low_stock_medicines") or []
    if low:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Low stock medicines (top 10)", heading_style))
        story.append(Spacer(1, 3 * mm))
        low_data = [["Medicine", "Current stock", "Expiry"]]
        for row in low:
            low_data.append([row.get("medicine_name", ""), str(row.get("current_stock", 0)), row.get("expiry_date") or "—"])
        t3 = Table(low_data, colWidths=[80 * mm, 45 * mm, 45 * mm])
        t3.setStyle(TableStyle(_table_style_header()))
        story.append(t3)
    return _build_pdf(story)


def _build_laboratory_pdf(data: Dict[str, Any], report_date: date) -> BytesIO:
    story, heading_style, _ = _make_story("Laboratory Overview Report", report_date)
    metrics = [
        ["Metric", "Value"],
        ["Pending tests", str(data.get("pending_tests", 0))],
        ["Completed today", str(data.get("completed_today", 0))],
        ["Active technicians", str(data.get("active_technicians", 0))],
        ["Critical results", str(data.get("critical_results", 0))],
    ]
    t1 = Table(metrics, colWidths=[80 * mm, 60 * mm])
    t1.setStyle(TableStyle(_table_style_header() + [("BACKGROUND", (0, 1), (-1, -1), colors.beige)]))
    story.append(Paragraph("Summary", heading_style))
    story.append(Spacer(1, 3 * mm))
    story.append(t1)
    vol = data.get("daily_test_volume_by_category") or []
    if vol:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Daily test volume by category", heading_style))
        story.append(Spacer(1, 3 * mm))
        vol_data = [["Category", "Completed", "Pending"]]
        for row in vol:
            vol_data.append([row.get("category", ""), str(row.get("completed", 0)), str(row.get("pending", 0))])
        t2 = Table(vol_data, colWidths=[70 * mm, 45 * mm, 45 * mm])
        t2.setStyle(TableStyle(_table_style_header()))
        story.append(t2)
    return _build_pdf(story)


def _build_billing_finance_pdf(data: Dict[str, Any], report_date: date) -> BytesIO:
    story, heading_style, _ = _make_story("Billing & Finance Report", report_date)
    metrics = [
        ["Metric", "Value"],
        ["Today's revenue", f"{data.get('todays_revenue', 0):,.2f}"],
        ["Outstanding balance", f"{data.get('outstanding_balance', 0):,.2f}"],
        ["Insurance claims", str(data.get("insurance_claims", 0))],
        ["Today's expenses", f"{data.get('todays_expenses', 0):,.2f}"],
    ]
    t1 = Table(metrics, colWidths=[80 * mm, 60 * mm])
    t1.setStyle(TableStyle(_table_style_header() + [("BACKGROUND", (0, 1), (-1, -1), colors.beige)]))
    story.append(Paragraph("Summary", heading_style))
    story.append(Spacer(1, 3 * mm))
    story.append(t1)
    inv = data.get("recent_invoices") or []
    if inv:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Recent invoices", heading_style))
        story.append(Spacer(1, 3 * mm))
        inv_data = [["Invoice", "Patient", "Date", "Amount", "Status"]]
        for row in inv:
            inv_data.append([
                row.get("invoice_id", ""),
                row.get("patient", ""),
                row.get("date", ""),
                f"{row.get('amount', 0):,.2f}",
                row.get("status", ""),
            ])
        t2 = Table(inv_data, colWidths=[35 * mm, 45 * mm, 35 * mm, 35 * mm, 30 * mm])
        t2.setStyle(TableStyle(_table_style_header()))
        story.append(t2)
    return _build_pdf(story)


def _build_hr_staff_pdf(data: Dict[str, Any], report_date: date) -> BytesIO:
    story, heading_style, _ = _make_story("HR & Staff Report", report_date)
    metrics = [
        ["Metric", "Value"],
        ["Staff on duty", str(data.get("staff_on_duty", 0))],
        ["Active shifts", str(data.get("active_shifts", 0))],
        ["Absent today", str(data.get("absent_today", 0))],
        ["On leave", str(data.get("on_leave", 0))],
    ]
    t1 = Table(metrics, colWidths=[80 * mm, 60 * mm])
    t1.setStyle(TableStyle(_table_style_header() + [("BACKGROUND", (0, 1), (-1, -1), colors.beige)]))
    story.append(Paragraph("Summary", heading_style))
    story.append(Spacer(1, 3 * mm))
    story.append(t1)
    staff_list = data.get("live_staff_status") or []
    if staff_list:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Staff status", heading_style))
        story.append(Spacer(1, 3 * mm))
        s_data = [["Name", "Role", "Department", "Status"]]
        for row in staff_list[:30]:  # limit rows
            s_data.append([
                str(row.get("name", ""))[:25],
                str(row.get("role", ""))[:15],
                str(row.get("department", ""))[:15],
                str(row.get("status", "")),
            ])
        t2 = Table(s_data, colWidths=[55 * mm, 40 * mm, 40 * mm, 35 * mm])
        t2.setStyle(TableStyle(_table_style_header()))
        story.append(t2)
    return _build_pdf(story)


def _build_alerts_pdf(data: Dict[str, Any], report_date: date) -> BytesIO:
    story, heading_style, _ = _make_story("Alerts & Monitoring Report", report_date)
    metrics = [
        ["Metric", "Value"],
        ["Critical emergencies", str(data.get("critical_emergencies", 0))],
        ["Active warnings", str(data.get("active_warnings", 0))],
        ["Resolved today", str(data.get("resolved_today", 0))],
        ["Avg response time (min)", str(data.get("avg_response_time_minutes", 0))],
    ]
    t1 = Table(metrics, colWidths=[90 * mm, 60 * mm])
    t1.setStyle(TableStyle(_table_style_header() + [("BACKGROUND", (0, 1), (-1, -1), colors.beige)]))
    story.append(Paragraph("Summary", heading_style))
    story.append(Spacer(1, 3 * mm))
    story.append(t1)
    feed = data.get("alerts_feed") or []
    if feed:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Recent alerts (last 24h)", heading_style))
        story.append(Spacer(1, 3 * mm))
        f_data = [["ID", "Type", "Severity", "Message", "Resolved"]]
        for row in feed[:25]:
            f_data.append([
                row.get("short_id", ""),
                str(row.get("type", ""))[:12],
                str(row.get("severity", ""))[:10],
                str(row.get("message", ""))[:30],
                "Yes" if row.get("is_resolved") else "No",
            ])
        t2 = Table(f_data, colWidths=[25 * mm, 30 * mm, 28 * mm, 55 * mm, 22 * mm])
        t2.setStyle(TableStyle(_table_style_header()))
        story.append(t2)
    return _build_pdf(story)


def _build_analytics_pdf(data: Dict[str, Any], report_date: date) -> BytesIO:
    story, heading_style, body_style = _make_story("Analytics & Forecasts Report", report_date)
    story.append(Paragraph(f"Total beds: {data.get('total_beds', 0)}", body_style))
    cond = data.get("condition_distribution") or {}
    metrics = [
        ["Condition", "Count"],
        ["Normal", str(cond.get("normal", 0))],
        ["Critical", str(cond.get("critical", 0))],
        ["Emergency", str(cond.get("emergency", 0))],
    ]
    t1 = Table(metrics, colWidths=[80 * mm, 60 * mm])
    t1.setStyle(TableStyle(_table_style_header() + [("BACKGROUND", (0, 1), (-1, -1), colors.beige)]))
    story.append(Paragraph("Condition distribution", heading_style))
    story.append(Spacer(1, 3 * mm))
    story.append(t1)
    adm = data.get("admission_forecast") or []
    if adm:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Admission forecast (7 days)", heading_style))
        story.append(Spacer(1, 3 * mm))
        a_data = [["Date", "Predicted"]]
        for row in adm:
            a_data.append([row.get("date", ""), str(row.get("predicted_count", 0))])
        t2 = Table(a_data, colWidths=[60 * mm, 50 * mm])
        t2.setStyle(TableStyle(_table_style_header()))
        story.append(t2)
    rev = data.get("revenue_forecast") or []
    if rev:
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("Revenue forecast (7 days)", heading_style))
        story.append(Spacer(1, 3 * mm))
        r_data = [["Date", "Predicted revenue"]]
        for row in rev:
            r_data.append([row.get("date", ""), f"{row.get('predicted_revenue', 0):,.2f}"])
        t3 = Table(r_data, colWidths=[60 * mm, 50 * mm])
        t3.setStyle(TableStyle(_table_style_header()))
        story.append(t3)
    return _build_pdf(story)


@router.get("/dashboard-pdf")
async def get_dashboard_pdf(
    date_param: Optional[date] = Query(None, alias="date"),
    page: Optional[str] = Query("overview", alias="page"),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a PDF report for the given admin page and date.
    page: overview | patients-beds | pharmacy | laboratory | billing-finance | hr-staff | alerts | analytics
    """
    base_date = date_param or datetime.utcnow().date()
    page = (page or "overview").strip().lower()

    try:
        if page == "overview":
            data = await get_hospital_overview(date_param=base_date, db=db)
            buffer = _build_overview_pdf(data, base_date)
            filename = f"Hospital_Overview_{base_date.isoformat()}.pdf"
        elif page == "patients-beds":
            data = await get_patients_beds_overview(date_param=base_date, db=db)
            buffer = _build_patients_beds_pdf(data, base_date)
            filename = f"Patients_Beds_{base_date.isoformat()}.pdf"
        elif page == "pharmacy":
            data = await get_pharmacy_overview(date_param=base_date, db=db)
            buffer = _build_pharmacy_pdf(data, base_date)
            filename = f"Pharmacy_{base_date.isoformat()}.pdf"
        elif page == "laboratory":
            data = await get_laboratory_overview(date_param=base_date, db=db)
            buffer = _build_laboratory_pdf(data, base_date)
            filename = f"Laboratory_{base_date.isoformat()}.pdf"
        elif page == "billing-finance":
            data = await get_billing_finance_overview(date_param=base_date, db=db)
            buffer = _build_billing_finance_pdf(data, base_date)
            filename = f"Billing_Finance_{base_date.isoformat()}.pdf"
        elif page == "hr-staff":
            data = await get_hr_staff_overview(date_param=base_date, db=db)
            buffer = _build_hr_staff_pdf(data, base_date)
            filename = f"HR_Staff_{base_date.isoformat()}.pdf"
        elif page == "alerts":
            data = await get_alerts_overview(db=db)
            buffer = _build_alerts_pdf(data, base_date)
            filename = f"Alerts_{base_date.isoformat()}.pdf"
        elif page == "analytics":
            data = await get_analytics_forecasts(db=db)
            buffer = _build_analytics_pdf(data, base_date)
            filename = f"Analytics_{base_date.isoformat()}.pdf"
        else:
            # fallback to overview for unknown or "staff" (user management)
            data = await get_hospital_overview(date_param=base_date, db=db)
            buffer = _build_overview_pdf(data, base_date)
            filename = f"Hospital_Overview_{base_date.isoformat()}.pdf"

        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF: {exc}",
        )
