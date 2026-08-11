"""Cycle prediction engine: global model inference + median fallback.

Global XGBoost model is used when available and the user has >= 3 cycles.
Otherwise a simple median-based fallback with avg_error correction is used.

Model artifact contract (mlops_retrain_plan.md §2):
- ``feature_names`` MUST equal ``feature_builder.contract_feature_keys()``.
- ``coefficients`` are XGBoost ``feature_importances_`` used as LINEAR WEIGHTS.
  They are non-negative and sum to 1 — this is a documented v1 approximation, NOT
  a regression model (no intercept + weighted-sum semantics). If the artifact
  cannot be validated, the engine FAILS TO FALLBACK rather than predict with
  wrong features.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from datetime import date
from statistics import median
from typing import Any

import numpy as np

from app.core.config import MODEL_STORAGE_DIR
from app.modules.cycle.feature_builder import build_feature_vector

logger = logging.getLogger("app.modules.cycle.prediction")

PROD_DIR = os.path.join(MODEL_STORAGE_DIR, "prod")


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


# ---- Rolling window features (FIFO 3-cycle feature vector) ----


def _is_irregular(cycle_length: int | None, period_length: int | None) -> int:
    """Return 1 if the cycle is irregular, 0 otherwise.

    A cycle is irregular if:
    - cycle_length < 21 or > 35 days, OR
    - period_length < 2 or > 8 days
    """
    if cycle_length is not None and (cycle_length < 21 or cycle_length > 35):
        return 1
    if period_length is not None and (period_length < 2 or period_length > 8):
        return 1
    return 0


def _compute_trend_slope(values: list[int | None]) -> float | None:
    """Linear regression slope of non-None values.

    x-axis is [1, 2, 3, ...] (recency order, index 0 = most recent).
    Positive slope = values increasing over time (cycles getting longer).
    """
    clean = [v for v in values if v is not None]
    if len(clean) < 2:
        return None
    n = len(clean)
    x = list(range(n))
    y = clean
    x_mean = sum(x) / n
    y_mean = sum(y) / n
    num = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
    den = sum((x[i] - x_mean) ** 2 for i in range(n))
    if den == 0:
        return None
    return round(num / den, 4)


@dataclass
class RollingWindowFeatures:
    """Feature vector built from the 3 most recent completed cycles.

    prev_1 = most recent completed cycle, prev_2 = second most recent, etc.
    All None-safe: if fewer than 3 cycles exist, missing slots are None.
    """

    prev_1_cycle_length: int | None = None
    prev_1_period_length: int | None = None
    prev_1_irregular: int = 0
    prev_2_cycle_length: int | None = None
    prev_2_period_length: int | None = None
    prev_2_irregular: int = 0
    prev_3_cycle_length: int | None = None
    prev_3_period_length: int | None = None
    prev_3_irregular: int = 0
    avg_cycle_length: float = 28.0
    avg_period_length: float = 5.0
    trend_slope: float | None = None


def build_rolling_features(
    cycle_lengths: list[int],
    period_lengths: list[int],
) -> RollingWindowFeatures:
    """Build the 3-cycle rolling window feature vector.

    Args:
        cycle_lengths: Consecutive cycle length diffs, most recent first.
                       cycle_lengths[0] = gap between most recent and 2nd most recent.
        period_lengths: Per-entry period lengths, most recent first.
                        period_lengths[0] = most recent period's duration.

    Returns:
        RollingWindowFeatures with up to 3 cycles of data, aggregated stats,
        and a trend slope computed from the cycle length series.
    """
    cl = cycle_lengths
    pl = period_lengths

    prev_1_cl = cl[0] if len(cl) > 0 else None
    prev_2_cl = cl[1] if len(cl) > 1 else None
    prev_3_cl = cl[2] if len(cl) > 2 else None

    prev_1_pl = pl[0] if len(pl) > 0 else None
    prev_2_pl = pl[1] if len(pl) > 1 else None
    prev_3_pl = pl[2] if len(pl) > 2 else None

    # Median of available values for aggregated features
    valid_cl = [v for v in [prev_1_cl, prev_2_cl, prev_3_cl] if v is not None]
    valid_pl = [v for v in [prev_1_pl, prev_2_pl, prev_3_pl] if v is not None]

    avg_cycle = float(median(valid_cl)) if valid_cl else 28.0
    avg_period = float(median(valid_pl)) if valid_pl else 5.0

    # Trend slope from cycle lengths (prev_3 -> prev_2 -> prev_1 = index 2, 1, 0)
    # Reverse to chronological order for regression
    trend = _compute_trend_slope([prev_3_cl, prev_2_cl, prev_1_cl])

    return RollingWindowFeatures(
        prev_1_cycle_length=prev_1_cl,
        prev_1_period_length=prev_1_pl,
        prev_1_irregular=_is_irregular(prev_1_cl, prev_1_pl),
        prev_2_cycle_length=prev_2_cl,
        prev_2_period_length=prev_2_pl,
        prev_2_irregular=_is_irregular(prev_2_cl, prev_2_pl),
        prev_3_cycle_length=prev_3_cl,
        prev_3_period_length=prev_3_pl,
        prev_3_irregular=_is_irregular(prev_3_cl, prev_3_pl),
        avg_cycle_length=avg_cycle,
        avg_period_length=avg_period,
        trend_slope=trend,
    )


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
    user_std: float | None = None,
) -> tuple[int, float, int | None]:
    """Simple median-based fallback when global model is unavailable.

    Returns ``(predicted_length, confidence, window_days)``.

    The prediction window is only emitted when the user is irregular
    (``std_dev > 3.5``), mirroring the global-model path.
    """
    if len(cycle_lengths) >= 3:
        base = int(median(cycle_lengths))
        confidence = 0.40
    else:
        base = 28
        confidence = 0.20

    if avg_error is not None and abs(avg_error) > 0.1:
        base = round(base + avg_error)
        confidence = max(0.15, confidence - 0.05)

    base = max(20, min(45, base))
    pred_std = user_std
    if pred_std is None:
        pred_std = float(np.std(cycle_lengths)) if len(cycle_lengths) >= 2 else None
    window = int(pred_std) if pred_std is not None and pred_std > 3.5 else None

    return base, round(confidence, 2), window


# ---- Global model inference (server-side, same arithmetic as mobile) ----


def is_valid_global_model(model: dict[str, Any] | None) -> bool:
    """Return True only if the artifact carries the full contract shape.

    Anything else (old XGBoost dump, truncated write, wrong schema) is invalid and
    the caller must fall back instead of predicting with wrong features.
    """
    if not isinstance(model, dict):
        return False
    if not isinstance(model.get("coefficients"), dict):
        return False
    if not isinstance(model.get("feature_names"), list) or not model["feature_names"]:
        return False
    return all(name in model["coefficients"] for name in model["feature_names"])


def _load_global_model(version: int | None = None) -> dict[str, Any] | None:
    """Load the active global model JSON from disk.

    Returns None when the file is missing OR the artifact is invalid (old schema,
    no ``coefficients``) so callers degrade to the fallback predictor.
    """
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
    try:
        with open(path) as f:
            model: dict[str, Any] = json.load(f)
    except Exception:
        logger.warning("model_artifact_unreadable", extra={"path": path})
        return None
    if not is_valid_global_model(model):
        logger.warning("model_artifact_invalid", extra={"path": path})
        return None
    return model


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
    user_sleep_hours: float | None = None,
    user_exercise_frequency: str | None = None,
    user_diet: str | None = None,
) -> tuple[int, float]:
    """Apply the global model to a user's feature vector.

    Feature construction goes through the shared ``build_feature_vector`` so the
    keys match the artifact's ``feature_names`` exactly (mlops_retrain_plan.md §1).
    ``coefficients`` are feature importances used as linear weights — documented
    approximation, NOT regression coefficients.

    Returns ``(predicted_length, confidence)``.
    """
    coef = model.get("coefficients", {})
    feature_names = model.get("feature_names", [])
    if not isinstance(coef, dict) or not feature_names:
        raise ValueError("invalid global model artifact: missing coefficients/feature_names")

    from datetime import datetime as _dt

    now = _dt.now()
    features = build_feature_vector(
        avg_cycle=user_avg_cycle,
        trend_slope=user_trend_slope,
        error_correction=user_avg_error,
        age_bucket=user_age_bucket_ordinal,
        bmi_bucket=user_bmi_bucket_ordinal,
        stress_level=user_stress_level,
        sleep_hours=user_sleep_hours,
        exercise_frequency=user_exercise_frequency,
        diet_type=user_diet,
        month=now.month,
        luteal_length=user_avg_cycle - 14,
    )

    # Weighted sum over the contract features. Feature importances are
    # non-negative and sum to 1; "intercept" is the baseline cycle length.
    prediction = float(coef.get("intercept", 28))
    for name in feature_names:
        prediction += float(coef.get(name, 0.0)) * features.get(name, 0.0)
    prediction += user_local_delta

    predicted_length = max(20, min(45, round(prediction)))

    # Confidence from model rmse
    model_rmse = model.get("rmse")
    if model_rmse is None:
        metadata = model.get("training_metadata", {})
        model_rmse = metadata.get("rmse", 3.0)
    confidence = max(0.5, min(0.95, 1.0 - (float(model_rmse) / 10)))

    return predicted_length, round(confidence, 2)
