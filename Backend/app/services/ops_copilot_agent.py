"""OpenAI-backed briefing generation for Ops Copilot. Requires OPENAI_API_KEY in the environment."""

from __future__ import annotations

import json
from typing import Any, Dict, List

import httpx
from pydantic import BaseModel, Field, field_validator

from app.core.ops_openai_settings import get_ops_openai_settings


class EvidenceLink(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)
    href: str = Field(..., min_length=1, max_length=500)


class BriefingLLMOutput(BaseModel):
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


SYSTEM_PROMPT = """You are an expert hospital operations analyst assistant embedded in a live admin dashboard.
You receive a JSON snapshot of operational metrics (bed occupancy by ward, admissions trend, alerts backlog, vitals acuity mix, revenue).
Your job is to produce ONE concise operational briefing for hospital leadership.

Rules:
- Be factual: only infer patterns supported by the numbers provided.
- Prefer the highest-impact issue (capacity, safety/alerts, revenue, or flow). If multiple are moderate, synthesize.
- recommended_actions must be specific operational steps (not generic "monitor").
- evidence_links must point to in-app routes only, using href starting with /admin/...
  Allowed examples: /admin, /admin/patients-beds, /admin/alerts, /admin/analytics, /admin/billing-finance
- Output MUST be a single JSON object matching the schema exactly. No markdown, no code fences.
"""


USER_TEMPLATE = """Here is the current operational snapshot (JSON). Generate the briefing JSON.

{signals_json}

Return JSON with keys:
title (string),
risk_category (short snake_case string e.g. capacity|alerts|revenue|flow|general),
what_changed (string),
why_it_matters (string),
recommended_actions (array of strings, 3-6 items),
evidence_links (array of objects with label and href).
"""


async def call_openai_for_briefing(signals: Dict[str, Any]) -> Dict[str, Any]:
    settings = get_ops_openai_settings()
    api_key = (settings.OPENAI_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to Backend/.env locally or to Railway environment variables."
        )

    model = (settings.OPENAI_OPS_COPILOT_MODEL or "gpt-4o-mini").strip()
    payload = {
        "model": model,
        "temperature": 0.35,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": USER_TEMPLATE.format(signals_json=json.dumps(signals, indent=2, default=str)),
            },
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        if r.status_code != 200:
            raise RuntimeError(f"OpenAI API error {r.status_code}: {r.text[:500]}")
        data = r.json()

    try:
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise RuntimeError(f"Unexpected OpenAI response shape: {e}") from e

    validated = BriefingLLMOutput.model_validate(parsed)
    links = [link.model_dump() for link in validated.evidence_links]
    if not links:
        links = [{"label": "Hospital overview", "href": "/admin"}]
    actions = validated.recommended_actions
    if not actions:
        actions = ["Review live metrics on the admin dashboard and align staffing with ward demand."]
    return {
        "title": validated.title,
        "risk_category": validated.risk_category or "general",
        "what_changed": validated.what_changed,
        "why_it_matters": validated.why_it_matters,
        "recommended_actions": actions,
        "evidence_links": links,
    }
