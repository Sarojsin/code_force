"""Cycle prediction engine: fallback chain + global model inference.

Phase 2: Pure global model strategy (Option A). No per-user models.

The fallback chain handles users with <10 cycles. Users with >=10 cycles
use the global XGBoost model (same arithmetic as mobile inference).
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
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression

logger = logging.getLogger("app.modules.cycle.prediction")

STORAGE_DIR = "/storage/models"
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


class CyclePredictor:
    """Fallback prediction chain for users with <10 cycles.

    Heuristic → Median → Linear Regression → Random Forest (per-user).
    This runs server-side when the global model isn't available or the
    user has insufficient data.
    """

    def __init__(self) -> None:
        self._lin_reg: LinearRegression | None = None
        self._rf_model: RandomForestRegressor | None = None

    def predict(
        self,
        cycle_start_dates: list[date],
        cycle_lengths: list[int],
        period_lengths: list[int],
        std_dev: float | None = None,
        avg_error: float | None = None,
    ) -> PredictionResult:
        n = len(cycle_lengths)

        if n < 3:
            model = "heuristic"
            predicted_length = 28
            confidence = 0.20
        elif n < 6:
            model = "median"
            predicted_length = int(median(cycle_lengths))
            confidence = 0.40 + (n / 10)
        elif n < 10:
            model = "linear_regression"
            predicted_length = self._train_and_predict_linear(cycle_lengths)
            confidence = 0.60 + (n / 10)
        else:
            model = "random_forest"
            predicted_length = self._train_and_predict_rf(cycle_lengths, period_lengths)
            confidence = min(0.95, 0.70 + (n / 20))

        if avg_error:
            predicted_length += avg_error

        window = None
        if std_dev and std_dev > 3.5:
            window = int(std_dev)
        elif n >= 3:
            window = {3: 7, 5: 5, 7: 3}.get(n, 3)

        latest_start = max(cycle_start_dates)
        next_start = latest_start + timedelta(days=round(predicted_length))
        next_end = next_start + timedelta(
            days=int(median(period_lengths)) if period_lengths else 5
        )
        fertile_start = next_start - timedelta(days=14)
        fertile_end = fertile_start + timedelta(days=5)

        return PredictionResult(
            next_period_start=next_start,
            next_period_end=next_end,
            fertile_window_start=fertile_start,
            fertile_window_end=fertile_end,
            confidence=round(confidence, 2),
            model_used=model,
            data_points=n,
            prediction_window_days=window,
        )

    @staticmethod
    def _train_and_predict_linear(lengths: list[int]) -> int:
        X = np.arange(len(lengths)).reshape(-1, 1)
        y = np.array(lengths)
        model = LinearRegression()
        model.fit(X, y)
        return round(model.predict([[len(lengths)]])[0])

    @staticmethod
    def _train_and_predict_rf(lengths: list[int], periods: list[int]) -> int:
        X = np.column_stack([np.arange(len(lengths)), lengths, periods[:len(lengths)]])
        y = np.array(lengths)
        model = RandomForestRegressor(n_estimators=100, max_depth=3, random_state=42)
        model.fit(X, y)
        next_X = np.array([[len(lengths), lengths[-1], periods[-1]]]).reshape(1, -1)
        return round(model.predict(next_X)[0])


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
