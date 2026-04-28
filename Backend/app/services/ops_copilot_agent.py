"""Hospital Ops Copilot — local rules + structured output (no external AI)."""

from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ops_copilot_sdk_tools import OPS_COPILOT_TOOLS, OpsCopilotContext


class EvidenceLink(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)
    href: str = Field(..., min_length=1, max_length=500)


class BriefingLLMOutput(BaseModel):
    """Structured briefing returned by the agent (matches DB + frontend contract)."""

    title: str = Field(..., min_length=1, max_length=500)
    risk_category: str = Field(default="general", max_length=128)
    what_changed: str = Field(..., min_length=1)
    why_it_matters: str = Field(..., min_length=1)
    recommended_actions: List[str] = Field(default_factory=list, max_length=12)
    evidence_links: List[EvidenceLink] = Field(default_factory=list, max_length=10)

    @field_validator("recommended_actions")
    @classmethod
    def strip_actions(cls, v: List[str]) -> List[str]:
        return [a.strip() for a in v if a and a.strip()][:12]


def _briefing_output_to_dict(out: BriefingLLMOutput) -> Dict[str, Any]:
    links = [link.model_dump() for link in out.evidence_links]
    if not links:
        links = [{"label": "Hospital overview", "href": "/admin"}]
    actions = out.recommended_actions
    if not actions:
        actions = ["Review live metrics on the admin dashboard and align staffing with ward demand."]
    return {
        "title": out.title,
        "risk_category": out.risk_category or "general",
        "what_changed": out.what_changed,
        "why_it_matters": out.why_it_matters,
        "recommended_actions": actions,
        "evidence_links": links,
    }


async def run_ops_copilot_agent(db: AsyncSession) -> Dict[str, Any]:
    """
    Generates an ops briefing using only local rule-based logic.
    No external API calls. Uses the same signals already collected
    from the database.
    """
    from app.services.ops_copilot_tools import collect_all_signals

    # Collect real metrics from DB (this was always local)
    signals = await collect_all_signals(db)

    # Extract key values with safe fallbacks
    occupancy = signals.get("occupancy", {})
    alerts = signals.get("alert_backlog", {})
    admissions = signals.get("admission_trend", {})
    revenue = signals.get("revenue_trend", {})
    acuity = signals.get("patient_acuity_mix", {})

    occupancy_rate = occupancy.get("occupancy_rate_pct", 0) or 0
    total_alerts = alerts.get("total_open", 0) or 0
    critical_alerts = alerts.get("critical_open", 0) or 0
    total_admissions_today = admissions.get("today", 0) or 0
    high_acuity_count = acuity.get("high", 0) or 0

    # Determine risk category
    if occupancy_rate >= 90 or critical_alerts >= 5:
        risk_category = "critical"
    elif occupancy_rate >= 75 or critical_alerts >= 2 or total_alerts >= 10:
        risk_category = "high"
    elif occupancy_rate >= 60 or total_alerts >= 5:
        risk_category = "moderate"
    else:
        risk_category = "low"

    # Build title
    title = f"Ops Briefing — {risk_category.capitalize()} Risk | Occupancy {occupancy_rate:.0f}%"

    # Build what_changed
    what_changed = (
        f"Current occupancy is {occupancy_rate:.1f}%. "
        f"There are {total_alerts} open alerts ({critical_alerts} critical). "
        f"Admissions today: {total_admissions_today}. "
        f"High-acuity patients: {high_acuity_count}."
    )

    # Build why_it_matters
    if risk_category == "critical":
        why_it_matters = (
            "Occupancy or critical alert levels have reached a threshold "
            "that requires immediate operational intervention to prevent "
            "patient safety risks and care delays."
        )
    elif risk_category == "high":
        why_it_matters = (
            "Current load indicators suggest elevated pressure on ward "
            "capacity and clinical staff. Proactive action now can prevent "
            "escalation to critical status."
        )
    elif risk_category == "moderate":
        why_it_matters = (
            "Operations are within manageable range but trending toward "
            "higher pressure. Monitoring and early preparation are advised."
        )
    else:
        why_it_matters = (
            "All key indicators are within normal operational range. "
            "Continue routine monitoring and standard protocols."
        )

    # Build recommended_actions
    actions: List[str] = []

    if occupancy_rate >= 90:
        actions.append(
            "Initiate bed management protocol immediately — "
            "review discharge candidates across all wards."
        )
    elif occupancy_rate >= 75:
        actions.append(
            "Review pending discharges and prepare overflow plan "
            "if occupancy continues to rise."
        )

    if critical_alerts >= 1:
        actions.append(
            f"Assign clinical lead to review {critical_alerts} "
            f"critical alert(s) within the next 30 minutes."
        )

    if total_alerts >= 10:
        actions.append(
            "Alert backlog is high — assign additional staff to "
            "triage and resolve open alerts."
        )

    if high_acuity_count >= 5:
        actions.append(
            f"{high_acuity_count} high-acuity patients on floor — "
            "confirm adequate nurse-to-patient ratio."
        )

    if not actions:
        actions.append(
            "No immediate action required. "
            "Maintain standard monitoring frequency."
        )

    # Build evidence_links (internal references only)
    evidence_links = [
        {"label": "Occupancy Dashboard", "href": "/admin/analytics"},
        {"label": "Alert Center", "href": "/admin/alerts"},
        {"label": "Patient Intelligence", "href": "/admin/patients"},
    ]

    # Keep the output shape identical to the previous agent dict output
    out = BriefingLLMOutput(
        title=title,
        risk_category=risk_category,
        what_changed=what_changed,
        why_it_matters=why_it_matters,
        recommended_actions=actions,
        evidence_links=[EvidenceLink(**l) for l in evidence_links],
    )
    return _briefing_output_to_dict(out)
