"""Hospital Ops Copilot — OpenAI Agents SDK (Runner + tools + structured output)."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from agents import Agent, Runner
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ops_openai_settings import get_ops_openai_settings
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


INSTRUCTIONS = """You are an AI hospital operations assistant.

You analyze real-time hospital operational metrics and detect meaningful operational changes.

Your goal is to generate short structured operational briefings that help hospital administrators make decisions.

Use the hospital_metrics tools to fetch live data. Call the tools you need—at minimum, gather enough
signal to justify your conclusions (often multiple tools are helpful).

Focus on:
- capacity risks (overall / ICU / ward hotspots)
- admission vs discharge imbalance or trend shifts
- alert workload spikes or unresolved critical backlog
- patient acuity distribution (vitals classifications)
- revenue anomalies or week-over-week paid collections shifts

When you finalize, your structured output MUST include:
- title: a concise headline (e.g. capacity or alert themed)
- risk_category: short snake_case (capacity|alerts|revenue|flow|general)
- what_changed: concrete, metric-backed summary
- why_it_matters: operational impact in plain language
- recommended_actions: 3–6 specific, actionable steps (not generic "monitor only")
- evidence_links: each item has label and href; href MUST start with /admin/ and point to relevant areas
  (e.g. /admin, /admin/patients-beds, /admin/alerts, /admin/analytics, /admin/billing-finance, /admin/ops-copilot)

Keep the briefing concise, clear, and actionable. Base claims on tool outputs only.
"""


USER_PROMPT = """Generate one current operational briefing for hospital leadership now.

Use tools to retrieve fresh metrics, then output the structured briefing."""


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
        tools=list(OPS_COPILOT_TOOLS),
        model=model_name,
        output_type=BriefingLLMOutput,
    )


async def run_ops_copilot_agent(db: AsyncSession) -> Dict[str, Any]:
    """
    Run the Ops Copilot agent: tools fetch metrics; agent returns a structured briefing dict
    (same shape as the previous direct-API implementation).
    """
    settings = get_ops_openai_settings()
    api_key = (settings.OPENAI_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to Backend/.env locally or to Railway environment variables."
        )

    model = (settings.OPENAI_OPS_COPILOT_MODEL or "gpt-4o-mini").strip()

    # Agents SDK reads OPENAI_API_KEY from the environment; sync from pydantic-settings / .env.
    os.environ["OPENAI_API_KEY"] = api_key

    agent = _build_agent(model)
    run_context = OpsCopilotContext(db=db)

    try:
        result = await Runner.run(
            agent,
            USER_PROMPT,
            context=run_context,
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
