"""Cycle prediction engine: global model inference + median fallback.

Global XGBoost model is used when available and the user has >= 3 cycles.
Otherwise a simple median-based fallback with avg_error correction is used.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from datetime import date, timedelta
from statistics import median
from typing import Any

import numpy as np

logger = logging.getLogger("app.modules.cycle.prediction")

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "scripts", "..", "storage", "models")
PROD_DIR = os.path.join(STORAGE_DIR, "prod")


@dataclass
class PredictionResult:
    next_period_start: date
    next_period_end: date | None
    fertile_window_start: date
    fertile_window_end: date
    confidence: float
    model_used: str
    data_points: int
    prediction_window_days: int | None


def confidence_label(score: float) -> str:
    if score < 0.31:
        return "Very uncertain"
    if score < 0.51:
        return "Uncertain"
    if score < 0.71:
        return "Fair"
    if score < 0.85:
        return "Good"
    return "Excellent"


def fallback_prediction(
    cycle_lengths: list[int],
    avg_error: float | None = None,
) -> tuple[int, float, int]:
    """Simple median-based fallback when global model is unavailable.

    Returns ``(predicted_length, confidence, window_days)``.
    """
    if len(cycle_lengths) >= 3:
        base = int(median(cycle_lengths))
        confidence = 0.40
    else:
        base = 28
        confidence = 0.20

    if avg_error is not None and abs(avg_error) > 0.1:
        base = int(round(base + avg_error))
        confidence = max(0.15, confidence - 0.05)

    base = max(20, min(45, base))
    pred_std = float(np.std(cycle_lengths)) if len(cycle_lengths) >= 2 else 5.0
    window = max(3, min(10, int(pred_std)))

    return base, round(confidence, 2), window


# ---- Global model inference (server-side, same arithmetic as mobile) ----


def _load_global_model(version: int | None = None) -> dict[str, Any] | None:
    """Load the active global model JSON from disk."""
    if version is not None:
        path = os.path.join(PROD_DIR, f"global_model_v{version}.json")
    else:
        try:
            import asyncio

            from sqlalchemy import select

            from app.core.database import AsyncSessionLocal
            from app.modules.cycle.models import SystemConfig

            async def _get_path() -> str | None:
                async with AsyncSessionLocal() as session:
                    result = await session.execute(
                        select(SystemConfig.value).where(SystemConfig.key == "global_model_path")
                    )
                    return result.scalar_one_or_none()

            filename = asyncio.run(_get_path())
            if not filename:
                return None
            path = os.path.join(PROD_DIR, filename)
        except Exception:
            return None

    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def apply_global_model(
    model: dict[str, Any],
    user_avg_cycle: float,
    user_std_cycle: float | None = None,
    user_trend_slope: float | None = None,
    user_avg_error: float | None = None,
    user_age_bucket_ordinal: float = 0,
    user_bmi_bucket_ordinal: float = 0,
    user_stress_level: str | None = None,
    user_avg_period_length: float = 5,
    user_local_delta: float = 0,
) -> tuple[int, float]:
    """Apply global model arithmetic (same as mobile ``predictNextCycle``).

    Returns ``(predicted_length, confidence)``.
    """
    coef = model.get("coefficients", {})
    scaler = model.get("scaler", {})

    prediction = coef.get("intercept", 28)

    norm_avg = (
        (user_avg_cycle - scaler.get("avg_cycle_mean", 29))
        / max(scaler.get("avg_cycle_std", 4), 0.01)
    )
    prediction += coef.get("avg_cycle", 0) * norm_avg
    prediction += coef.get("bmi_bucket", 0) * user_bmi_bucket_ordinal
    prediction += coef.get("age_bucket", 0) * user_age_bucket_ordinal

    if user_trend_slope is not None:
        prediction += coef.get("trend_slope", 0) * user_trend_slope
    if user_avg_error is not None:
        prediction += coef.get("error_correction", 0) * user_avg_error

    if user_stress_level == "high":
        prediction += coef.get("stress_high", 0)
    elif user_stress_level == "moderate":
        prediction += coef.get("stress_moderate", 0)

    from datetime import datetime as _dt
    now = _dt.now()
    prediction += coef.get("month_sin", 0) * np.sin(2 * np.pi * now.month / 12)
    prediction += coef.get("month_cos", 0) * np.cos(2 * np.pi * now.month / 12)

    prediction += coef.get("luteal_length", 0) * (user_avg_cycle - 14)

    prediction += user_local_delta

    predicted_length = max(20, min(45, round(prediction)))

    # Confidence from model rmse
    model_rmse = model.get("rmse", 3.0)
    confidence = max(0.5, min(0.95, 1.0 - (model_rmse / 10)))

    return predicted_length, round(confidence, 2)
