"""Hospital Ops Copilot — OpenAI Agents SDK (Runner + tools + structured output)."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from agents import Agent, Runner
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ops_openai_settings import get_ops_openai_settings, resolve_openai_api_key
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


INSTRUCTIONS = """You are an AI hospital operations assistant for an admin dashboard.

You must produce ONE combined operational briefing that reflects the overall hospital situation—not a
single-domain report. The hospital leadership expects a high-level picture across major operational areas.

## How you must use tools (hospital_metrics)

- Before writing the briefing, call MULTIPLE tools (typically at least three different tools) so you
  understand capacity, patient flow signals, alerts, acuity, and revenue together. Do not stop after one
  tool unless the model/runtime truly prevents further calls.
- Synthesize across tool outputs: identify the top 2–3 most important operational risks or changes
  across the whole system. If several issues are moderate, summarize them compactly rather than listing
  many small items.
- Do NOT anchor the briefing primarily on admissions unless admission/flow signals are clearly the
  dominant risk compared to everything else you fetched. If admissions are only one part of the story,
  keep them in proportion.

## What each tool family is for (read all that apply before concluding)

- get_occupancy_by_ward: Bed & capacity — overall occupancy, ICU occupancy, ward-level overcrowding or
  unusually low utilization (by_ward).
- get_admission_trend: Admissions trend and week-over-week volume change; combine with occupancy to
  infer flow pressure (e.g. rising occupancy with falling admissions may suggest discharge friction—
  infer cautiously from metrics you have).
- get_alert_backlog: Alerts — unresolved critical count, other unresolved tiers, and intake spikes
  (last 24h / today created).
- get_patient_acuity_mix: Vitals / acuity — critical + emergency burden vs normal; rising high_acuity_pct.
- get_revenue_trend: Billing & finance — paid revenue by day and week-over-week change; unexpected drops
  or spikes vs recent baseline.

## Cross-dashboard reasoning (use when supported by tool numbers)

Examples of combined interpretations (only state if metrics support them):
- High occupancy + high alert intake or unresolved critical backlog → workload / safety pressure.
- Rising critical/emergency share + strained capacity → acuity–capacity risk.
- Strong admissions signal but occupancy staying very high → possible slow throughput / discharge side
  (state as hypothesis tied to numbers).
- Paid revenue down week-over-week while other operational signals look stable → possible billing /
  collections lag (tie to revenue tool).

## Output format (unchanged contract)

When you finalize, your structured output MUST include:
- title: one short, clear headline capturing the MAIN overall operational concern (not only admissions).
- risk_category: short snake_case (capacity|alerts|revenue|flow|general|acuity)
- what_changed: concrete, metric-backed summary of the most important changes ACROSS areas you queried.
- why_it_matters: plain-language operational impact for the hospital as a whole.
- recommended_actions: 3–5 practical steps an admin can take (specific, not generic "monitor only").
- evidence_links: 3–6 items with label + href. Prefer linking to the dashboard areas that support your
  narrative. Allowed bases include:
  /admin
  /admin/patients-beds
  /admin/alerts
  /admin/billing-finance
  /admin/billing-finance/analytics
  /admin/ops-copilot
  /admin/pharmacy
  /admin/laboratory
  /admin/hr-staff
  For analytics deep-links, use anchors (not bare /admin/analytics when a specific chart applies), e.g.:
  /admin/analytics#analytics-admissions-forecast
  /admin/analytics#analytics-ward-demand
  /admin/analytics#analytics-revenue-forecast
  /admin/analytics#analytics-vitals-condition-mix
  /admin/analytics#analytics-alerts-trend
  Do not use /admin/patient-acuity (legacy).

Keep the briefing concise. Base factual claims on tool outputs only; do not invent numbers.
"""


USER_PROMPT = """Generate one current operational briefing for hospital leadership now.

Workflow:
1) Call several hospital_metrics tools (capacity, admissions trend, alerts, acuity mix, revenue—use
   what is needed so the picture is whole-hospital, not admissions-only).
2) From those results, pick the top 2–3 operational risks or changes that matter most together.
3) Output the structured briefing (title, risk_category, what_changed, why_it_matters,
   recommended_actions, evidence_links) following the system instructions."""


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


def _build_agent(model_name: str) -> Agent:
    return Agent(
        name="Hospital Ops Copilot",
        instructions=INSTRUCTIONS,
        tools=list(OPS_COPILOT_TOOLS),  # flat list[FunctionTool] from tool_namespace
        model=model_name,
        output_type=BriefingLLMOutput,
    )


async def run_ops_copilot_agent(db: AsyncSession) -> Dict[str, Any]:
    """
    Run the Ops Copilot agent: tools fetch metrics; agent returns a structured briefing dict
    (same shape as the previous direct-API implementation).
    """
    settings = get_ops_openai_settings()
    api_key = resolve_openai_api_key()
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set for this server process. "
            "On Railway: open the service that runs this API (same URL as NEXT_PUBLIC_API_URL on Vercel) → "
            "Variables → add OPENAI_API_KEY (exact name) → Redeploy. "
            "GET /api/ops-copilot/openai-env-status (admin) shows whether the running instance sees the key."
        )

    model = (settings.OPENAI_OPS_COPILOT_MODEL or "gpt-4o-mini").strip()

    # Agents SDK reads OPENAI_API_KEY from the environment; sync from pydantic-settings / .env.
    os.environ["OPENAI_API_KEY"] = api_key

    agent = _build_agent(model)
    run_context = OpsCopilotContext(db=db)

    max_turns = int(settings.OPENAI_OPS_COPILOT_MAX_TURNS)

    try:
        result = await Runner.run(
            agent,
            USER_PROMPT,
            context=run_context,
            max_turns=max_turns,
        )
    except Exception as e:
        raise RuntimeError(f"Ops Copilot agent run failed: {e}") from e

    final = result.final_output

    if isinstance(final, BriefingLLMOutput):
        return _briefing_output_to_dict(final)

    if isinstance(final, str):
        try:
            parsed = json.loads(final)
            validated = BriefingLLMOutput.model_validate(parsed)
            return _briefing_output_to_dict(validated)
        except (json.JSONDecodeError, ValueError) as e:
            raise RuntimeError(f"Agent returned unparsable briefing: {e}") from e

    raise RuntimeError(f"Unexpected agent output type: {type(final)}")
