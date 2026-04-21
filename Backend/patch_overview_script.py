import re

with open("F:/BSCS 7th Semester/Real Time Intelligent Dashboard in Health Care/Backend/app/api/routers/overview.py", "r") as f:
    content = f.read()

# I will replace the return block to include new fields, and add logic before it.
new_logic = """
        # ---- 7-Day Trends (for mini charts and averages) ----
        bed_occupancy_trend = []
        icu_occupancy_trend = []
        revenue_trend = []
        
        for i in range(7):
            d = seven_days_ago + timedelta(days=i)
            d_start = datetime.combine(d, time.min)
            d_end = datetime.combine(d, time.max)
            
            # Active admissions on day d
            active_d_subq = (
                select(Admission.id, Admission.bed_id)
                .where(
                    and_(
                        Admission.admission_date <= d_end,
                        or_(Admission.discharge_date.is_(None), Admission.discharge_date >= d_start),
                    )
                )
                .subquery()
            )
            
            # Bed occupancy on day d
            occ_d_result = await db.execute(
                select(func.count(func.distinct(Bed.id)))
                .select_from(Bed)
                .join(active_d_subq, Bed.id == active_d_subq.c.bed_id)
                .where(Bed.status == "Occupied")
            )
            occ_d = occ_d_result.scalar_one() or 0
            bed_pct = (float(occ_d) / float(total_beds) * 100.0) if total_beds > 0 else 0.0
            bed_occupancy_trend.append(bed_pct)
            
            # ICU occupancy on day d
            icu_occ_d_result = await db.execute(
                select(func.count(func.distinct(Bed.id)))
                .select_from(Bed)
                .join(active_d_subq, Bed.id == active_d_subq.c.bed_id)
                .where(Bed.ward == "ICU")
            )
            icu_occ_d = icu_occ_d_result.scalar_one() or 0
            icu_pct = (float(icu_occ_d) / float(icu_total) * 100.0) if icu_total > 0 else 0.0
            icu_occupancy_trend.append(icu_pct)
            
            # Revenue on day d
            rev_d_result = await db.execute(
                select(func.coalesce(func.sum(Billing.amount), 0.0)).where(
                    and_(
                        Billing.status == BillingStatus.paid,
                        Billing.date >= d_start,
                        Billing.date <= d_end,
                    )
                )
            )
            rev_d = float(rev_d_result.scalar_one() or 0.0)
            revenue_trend.append(rev_d)
            
        bed_occupancy_7d_avg = sum(bed_occupancy_trend) / len(bed_occupancy_trend) if bed_occupancy_trend else 0.0
        icu_occupancy_7d_avg = sum(icu_occupancy_trend) / len(icu_occupancy_trend) if icu_occupancy_trend else 0.0
        revenue_7d_avg = sum(revenue_trend) / len(revenue_trend) if revenue_trend else 0.0

        return {
"""

content = content.replace("        return {", new_logic)

content = content.replace(
    '"bed_occupancy_by_department": bed_occupancy_by_department,',
    '"bed_occupancy_by_department": bed_occupancy_by_department,\n            "bed_occupancy_trend": bed_occupancy_trend,\n            "bed_occupancy_7d_avg": bed_occupancy_7d_avg,\n            "icu_occupancy_trend": icu_occupancy_trend,\n            "icu_occupancy_7d_avg": icu_occupancy_7d_avg,\n            "revenue_trend": revenue_trend,\n            "revenue_7d_avg": revenue_7d_avg,'
)

with open("F:/BSCS 7th Semester/Real Time Intelligent Dashboard in Health Care/Backend/patch_overview.py", "w") as f:
    f.write(content)
