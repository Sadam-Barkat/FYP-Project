import re

with open("F:/BSCS 7th Semester/Real Time Intelligent Dashboard in Health Care/Backend/app/api/routers/patients_beds.py", "r") as f:
    content = f.read()

# Add previous 7 days logic
new_logic = """
        # ----- Previous 7 Days (for comparison) -----
        fourteen_days_ago = base_date - timedelta(days=13)
        previous_seven_days_end = base_date - timedelta(days=7)

        prev_admissions_result = await db.execute(
            select(func.count())
            .select_from(Admission)
            .where(
                and_(
                    cast(Admission.admission_date, Date) >= fourteen_days_ago,
                    cast(Admission.admission_date, Date) <= previous_seven_days_end,
                )
            )
        )
        prev_admissions = prev_admissions_result.scalar_one() or 0

        prev_discharges_result = await db.execute(
            select(func.count())
            .select_from(Admission)
            .where(
                and_(
                    Admission.discharge_date.is_not(None),
                    cast(Admission.discharge_date, Date) >= fourteen_days_ago,
                    cast(Admission.discharge_date, Date) <= previous_seven_days_end,
                )
            )
        )
        prev_discharges = prev_discharges_result.scalar_one() or 0

        return {
"""

content = content.replace("        return {", new_logic)

content = content.replace(
    '"admissions_discharges_trend": admissions_discharges_trend,',
    '"admissions_discharges_trend": admissions_discharges_trend,\n            "previous_7_days_admissions": int(prev_admissions),\n            "previous_7_days_discharges": int(prev_discharges),'
)

with open("F:/BSCS 7th Semester/Real Time Intelligent Dashboard in Health Care/Backend/app/api/routers/patients_beds.py", "w") as f:
    f.write(content)
