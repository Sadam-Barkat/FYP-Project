"""OpenAI Ops Copilot settings from environment and optional Backend/.env file."""

from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Backend/ directory (parent of app/)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


class OpsOpenAISettings(BaseSettings):
    """
    Loads OPENAI_API_KEY and OPENAI_OPS_COPILOT_MODEL from:
    - process environment (e.g. Railway), then
    - Backend/.env when present (local dev).

    Never commit real keys; use Backend/.env.example as a template.
    """

    model_config = SettingsConfigDict(
        env_file=_BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    OPENAI_API_KEY: str = ""
    OPENAI_OPS_COPILOT_MODEL: str = "gpt-4o-mini"


def get_ops_openai_settings() -> OpsOpenAISettings:
    """Fresh read each call so deploy-time / Railway env changes are visible (no stale cache)."""
    return OpsOpenAISettings()


def resolve_openai_api_key() -> str:
    """
    API key for Ops Copilot. Prefer live os.environ (Railway injects here), then pydantic/.env.
    Case-insensitive env fallback helps with rare mis-typed variable names in hosting UIs.
    """
    direct = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if direct:
        return direct
    for k, v in os.environ.items():
        if k.upper() == "OPENAI_API_KEY" and (v or "").strip():
            return str(v).strip()
    return (get_ops_openai_settings().OPENAI_API_KEY or "").strip()


def openai_api_key_configured() -> bool:
    return bool(resolve_openai_api_key())
