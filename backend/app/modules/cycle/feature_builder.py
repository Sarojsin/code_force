"""Shared cycle-prediction feature contract (mlops_retrain_plan.md §1).

Canonical source of truth for the feature vector used by BOTH training and
inference. Rule: never construct these feature keys inline anywhere else:

- ``scripts/train_global_model.py`` → ``build_feature_vector``
- ``app/integrations/prediction_engine.py`` → ``build_feature_vector``

The artifact stores ``feature_names`` exactly as returned by
``contract_feature_keys()``; ``coefficients`` map those names to XGBoost
``feature_importances_`` (non-negative, sum to 1 — documented approximation, NOT
regression coefficients; see mlops_retrain_plan.md §2).

This module is deliberately stdlib-only so it can be unit-tested anywhere.
"""

from __future__ import annotations

import math

# Nominal value spaces (validated on the onboarding schemas).
STRESS_LEVELS: tuple[str, ...] = ("low", "moderate", "high")
EXERCISE_FREQUENCIES: tuple[str, ...] = ("low", "moderate", "high")
DIET_TYPES: tuple[str, ...] = ("balanced", "normal", "junk")

# Ordered base features (stable across runs).
BASE_FEATURE_KEYS: tuple[str, ...] = (
    "avg_cycle",
    "trend_slope",
    "error_correction",
    "age_bucket",
    "bmi_bucket",
    "stress_high",
    "stress_moderate",
    "sleep_hours",
    "month_sin",
    "month_cos",
    "luteal_length",
)

# Matches the CASE buckets in the legacy training SQL.
AGE_BUCKET_ORDINAL: dict[str, int] = {
    "18-20": 0,
    "21-25": 1,
    "26-30": 2,
    "31-35": 3,
    "36-40": 4,
    "40+": 5,
}

BMI_BUCKET_ORDINAL: dict[str, int] = {
    "underweight": 0,
    "normal": 1,
    "overweight": 2,
    "obese": 3,
}

_DEFAULT_AGE_BUCKET = 2  # 26-30
_DEFAULT_BMI_BUCKET = 1  # normal


def contract_feature_keys() -> list[str]:
    """Stable, ordered feature-name list; becomes the artifact ``feature_names``."""
    return (
        list(BASE_FEATURE_KEYS)
        + [f"exercise_{f}" for f in EXERCISE_FREQUENCIES]
        + [f"diet_{d}" for d in DIET_TYPES]
    )


def age_to_ordinal(age: int | float | None) -> int:
    """Bucket a raw age into the ordinal ``age_bucket`` feature."""
    if age is None:
        return _DEFAULT_AGE_BUCKET
    if age < 20:
        return 0
    if age < 25:
        return 1
    if age < 30:
        return 2
    if age < 35:
        return 3
    if age < 40:
        return 4
    return 5


def bmi_to_ordinal(bmi: float | None) -> int:
    """Bucket a raw BMI into the ordinal ``bmi_bucket`` feature."""
    if bmi is None:
        return _DEFAULT_BMI_BUCKET
    if bmi < 18.5:
        return 0
    if bmi < 25:
        return 1
    if bmi < 30:
        return 2
    return 3


def validate_feature_keys(feature_names: list[str]) -> None:
    """Fail fast if ``feature_names`` diverges from the canonical contract."""
    expected = contract_feature_keys()
    if feature_names != expected:
        raise ValueError(
            "feature_names diverged from FEATURE_CONTRACT: "
            f"expected {expected}, got {feature_names}"
        )


def build_feature_vector(
    *,
    avg_cycle: float = 28.0,
    trend_slope: float | None = None,
    error_correction: float | None = None,
    age: int | float | None = None,
    age_bucket: int | float | str | None = None,
    bmi: float | None = None,
    bmi_bucket: int | float | str | None = None,
    stress_level: str | None = None,
    sleep_hours: float | None = None,
    exercise_frequency: str | None = None,
    diet_type: str | None = None,
    month: int | None = None,
    luteal_length: float | None = None,
) -> dict[str, float]:
    """Build the canonical contract feature vector (keys = ``contract_feature_keys()``).

    Accepts pre-computed ordinal buckets OR raw ``age``/``bmi``. Every one-hot
    ``exercise_*``/``diet_*`` flag is always present (exactly one is 1.0) so
    ``feature_names`` is identical across training runs and inference.
    """
    if age_bucket is None and age is not None:
        age_bucket = age_to_ordinal(age)
    if isinstance(age_bucket, str):
        age_bucket = AGE_BUCKET_ORDINAL.get(age_bucket, _DEFAULT_AGE_BUCKET)
    if age_bucket is None:
        age_bucket = _DEFAULT_AGE_BUCKET
    age_bucket = int(age_bucket)

    if bmi_bucket is None and bmi is not None:
        bmi_bucket = bmi_to_ordinal(bmi)
    if isinstance(bmi_bucket, str):
        bmi_bucket = BMI_BUCKET_ORDINAL.get(bmi_bucket, _DEFAULT_BMI_BUCKET)
    if bmi_bucket is None:
        bmi_bucket = _DEFAULT_BMI_BUCKET
    bmi_bucket = int(bmi_bucket)

    resolved_month = month if month is not None else 1
    features: dict[str, float] = {
        "avg_cycle": float(avg_cycle),
        "trend_slope": float(trend_slope) if trend_slope is not None else 0.0,
        "error_correction": float(error_correction) if error_correction is not None else 0.0,
        "age_bucket": float(age_bucket),
        "bmi_bucket": float(bmi_bucket),
        "stress_high": 1.0 if stress_level == "high" else 0.0,
        "stress_moderate": 1.0 if stress_level == "moderate" else 0.0,
        "sleep_hours": float(sleep_hours) if sleep_hours is not None else 0.0,
        "month_sin": math.sin(2 * math.pi * resolved_month / 12),
        "month_cos": math.cos(2 * math.pi * resolved_month / 12),
        "luteal_length": float(luteal_length) if luteal_length is not None else 0.0,
    }
    for freq in EXERCISE_FREQUENCIES:
        features[f"exercise_{freq}"] = 1.0 if exercise_frequency == freq else 0.0
    for diet in DIET_TYPES:
        features[f"diet_{diet}"] = 1.0 if diet_type == diet else 0.0
    return features
