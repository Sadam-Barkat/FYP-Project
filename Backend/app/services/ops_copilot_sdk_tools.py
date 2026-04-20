"""
OpenAI Agent SDK function tools for Hospital Ops Copilot.

Each tool reads live data via AsyncSession from RunContextWrapper context.
Pure metric queries live in ops_copilot_tools.py; this module only wraps them for the SDK.
"""
from __future__ import annotations

from dataclasses import dataclass

from agents import RunContextWrapper, function_tool, tool_namespace
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import ops_copilot_tools as metrics


@dataclass
class OpsCopilotContext:
    """Run context passed to Runner.run(context=...); exposed to tools via RunContextWrapper."""

    db: AsyncSession


@function_tool
async def get_occupancy_by_ward(ctx: RunContextWrapper[OpsCopilotContext]) -> dict:
    """Returns bed occupancy grouped by ward for today (overall %, ICU %, per-ward breakdown)."""
    return await metrics.get_occupancy_by_ward(ctx.context.db)


@function_tool
async def get_admission_trend(ctx: RunContextWrapper[OpsCopilotContext]) -> dict:
    """Returns daily admission counts for the last 7 days plus week-over-week change vs prior 7 days."""
    return await metrics.get_admission_trend(ctx.context.db, days=7)


@function_tool
async def get_alert_backlog(ctx: RunContextWrapper[OpsCopilotContext]) -> dict:
    """Returns unresolved critical/warning-tier alert counts and alerts created in last 24h / today."""
    return await metrics.get_alert_backlog(ctx.context.db)


@function_tool
async def get_patient_acuity_mix(ctx: RunContextWrapper[OpsCopilotContext]) -> dict:
    """Returns vitals condition distribution (normal / critical / emergency) and high-acuity percentage."""
    return await metrics.get_patient_acuity_mix(ctx.context.db)


@function_tool
async def get_revenue_trend(ctx: RunContextWrapper[OpsCopilotContext]) -> dict:
    """Returns last-7-days paid revenue (PKR) by day plus week-over-week change vs prior 7 days."""
    return await metrics.get_revenue_trend(ctx.context.db, days=7)


# openai-agents: tool_namespace(...) returns a flat list[FunctionTool] for this SDK version;
# do not wrap in another list or Agent sees list as a single "tool" and raises Unknown tool type.
OPS_COPILOT_TOOLS = tool_namespace(
    name="hospital_metrics",
    description=(
        "Live cross-dashboard hospital metrics for one combined operational briefing. "
        "Includes: bed & ward occupancy (overall + ICU + per ward), 7-day admission trend with WoW change, "
        "alert backlog and recent intake, vitals-based acuity mix (normal/critical/emergency), and "
        "7-day paid revenue trend with WoW change. Call multiple tools to compare capacity, flow, "
        "alerts, acuity, and billing before summarizing the top operational risks."
    ),
    tools=[
        get_occupancy_by_ward,
        get_admission_trend,
        get_alert_backlog,
        get_patient_acuity_mix,
        get_revenue_trend,
    ],
)
