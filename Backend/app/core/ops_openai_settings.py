"""OpenAI Ops Copilot settings from environment and optional Backend/.env file."""

from __future__ import annotations

from functools import lru_cache
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
        extra="ignore",
    )

    OPENAI_API_KEY: str = ""
    OPENAI_OPS_COPILOT_MODEL: str = "gpt-4o-mini"


@lru_cache
def get_ops_openai_settings() -> OpsOpenAISettings:
    return OpsOpenAISettings()
