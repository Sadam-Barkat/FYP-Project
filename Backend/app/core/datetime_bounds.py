"""Calendar-day bounds in a configurable timezone (DB stores naive UTC datetimes)."""

from __future__ import annotations

import os
from datetime import date, datetime, time, timedelta
from typing import Tuple
from zoneinfo import ZoneInfo


def get_app_timezone() -> ZoneInfo:
    # Default Asia/Karachi matches typical deployment; override with APP_TIMEZONE=e.g. UTC
    name = (os.getenv("APP_TIMEZONE") or "Asia/Karachi").strip()
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo("UTC")


def utc_naive_now() -> datetime:
    """Match existing codebase usage (naive UTC)."""
    return datetime.utcnow()


def calendar_today_for_app(now_naive_utc: datetime | None = None) -> date:
    tz = get_app_timezone()
    now = now_naive_utc or utc_naive_now()
    return now.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz).date()


def day_bounds_utc_naive(base_date: date, tz: ZoneInfo | None = None) -> Tuple[datetime, datetime]:
    """
    Interpret base_date as a calendar day in tz; return inclusive UTC-naive [start, end]
    for comparing against TIMESTAMP WITHOUT TIME ZONE columns storing UTC.
    """
    tz = tz or get_app_timezone()
    start_local = datetime.combine(base_date, time.min, tzinfo=tz)
    end_local = datetime.combine(base_date, time.max.replace(microsecond=999999), tzinfo=tz)
    start_utc = start_local.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    end_utc = end_local.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    return start_utc, end_utc

