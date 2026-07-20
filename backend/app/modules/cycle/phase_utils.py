from __future__ import annotations

from datetime import date, timedelta


def compute_period_length(start_date: date, end_date: date | None, fallback: int = 5) -> int:
    if end_date:
        return (end_date - start_date).days + 1
    return fallback


def compute_notification_day(avg_period_length: int | None, fallback: int = 3) -> int:
    if avg_period_length and avg_period_length >= 3:
        return max(fallback, avg_period_length - 2)
    return fallback


def calculate_cycle_phases(
    period_start: date,
    cycle_length: int,
    period_length: int = 5,
) -> dict[str, date]:
    period_end = period_start + timedelta(days=period_length - 1)
    ovulation_offset = max(10, min(cycle_length - 14, 40))
    ovulation_date = period_start + timedelta(days=ovulation_offset)
    fertile_start = ovulation_date - timedelta(days=4)
    fertile_end = ovulation_date
    luteal_start = ovulation_date + timedelta(days=1)
    luteal_end = period_start + timedelta(days=cycle_length - 1)
    return {
        "period_start": period_start,
        "period_end": period_end,
        "fertile_start": fertile_start,
        "fertile_end": fertile_end,
        "ovulation_date": ovulation_date,
        "luteal_start": luteal_start,
        "luteal_end": luteal_end,
    }
