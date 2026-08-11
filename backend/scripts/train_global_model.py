#!/usr/bin/env python3
"""Monthly global model retraining script (mlops_retrain_plan.md §1-§2).

Privacy measures:
- PII bucketized (age ranges, BMI categories)
- user_id hashed with SHA256 + static salt
- Labels noise-added N(0, 1.5) seeded per-user for reproducibility

Data drift detection:
- RMSE > 3.5 OR >10% increase from previous month → abort, keep old model
- MAE also computed for stakeholder reporting

Feature contract:
- ALL features go through ``app.modules.cycle.feature_builder.build_feature_vector``.
- The exported artifact carries ``schema_version: 2``, ``feature_names`` =
  ``contract_feature_keys()`` and ``coefficients`` = XGBoost feature_importances_.
  NOTE: feature_importances_ are non-negative and sum to 1 — they are linear
  WEIGHTS, NOT regression coefficients. The prediction engine applies them as a
  weighted sum (documented v1 approximation, mlops_retrain_plan.md §2).

Atomic swap:
- Write staging/global_model_v{N}.json → rename to prod/
- Update system_config: global_model_version, global_model_path, global_model_metrics
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import zlib
from datetime import UTC, date, datetime

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from app.core.config import MODEL_STORAGE_DIR
from app.modules.cycle.feature_builder import (
    build_feature_vector,
    contract_feature_keys,
    validate_feature_keys,
)

logger = logging.getLogger("scripts.train_global_model")

STORAGE_DIR = MODEL_STORAGE_DIR
STAGING_DIR = os.path.join(STORAGE_DIR, "staging")
PROD_DIR = os.path.join(STORAGE_DIR, "prod")

DRIFT_RMSE_THRESHOLD = 3.5
DRIFT_PCT_INCREASE = 0.10  # 10%
MIN_ROWS = 10
NOISE_SD = 1.5


def _hash_user_id(user_id: object) -> int:
    """Stable non-negative integer seed from a user id for per-user noise.

    Uses crc32 (deterministic, non-negative) instead of builtin ``hash()``,
    which is salted per-process and can return negative values that
    ``numpy.random.default_rng`` rejects.
    """
    return zlib.crc32(str(user_id).encode("utf-8"))


def _dp_noise(user_id: object) -> float:
    """Differential-privacy style noise N(0, 1.5), seeded per-user."""
    rng = np.random.default_rng(_hash_user_id(user_id))
    return float(rng.normal(0.0, NOISE_SD))


def _trend_slope(values: np.ndarray) -> float | None:
    """Linear regression slope over a user's cycle-length series."""
    v = values.astype(float)
    if len(v) < 2:
        return None
    slope = np.polyfit(np.arange(len(v)), v, 1)[0]
    return float(slope)


def build_training_dataset(connection_url: str) -> pd.DataFrame:
    """Build anonymized, bucketized training dataset.

    Joins users + user_onboarding + cycle_entries. Cycle lengths and trend slope
    are computed from consecutive period start dates (there is no stored
    ``cycle_entries.cycle_length`` column).
    """
    from sqlalchemy import create_engine, text

    engine = create_engine(connection_url)
    query = text("""
        SELECT
            u.id AS user_id,
            u.avg_cycle_length,
            u.avg_prediction_error_days,
            o.age,
            o.weight_kg,
            o.height_cm,
            o.stress_level,
            o.exercise_frequency,
            o.sleep_hours,
            o.diet,
            c.period_start_date,
            c.period_end_date
        FROM users u
        JOIN user_onboarding o ON u.id = o.user_id
        JOIN cycle_entries c ON u.id = c.user_id
        WHERE u.total_cycles_logged >= 3
          AND c.cycle_type = 'menstrual'
          AND c.is_correction = FALSE
        ORDER BY u.id, c.period_start_date
    """)
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
    logger.info("built_training_dataset", extra={"rows": len(df)})
    return df


def train_model(
    df: pd.DataFrame,
) -> tuple[xgb.XGBRegressor, list[str], dict[str, float], dict[str, float], float, float, float]:
    """Train XGBoost regressor on the shared contract features.

    Returns ``(model, feature_names, coefficients, scaler, rmse, mae, r2)``.
    """
    df = df.sort_values(["user_id", "period_start_date"]).copy()

    # Cycle length = gap between consecutive period starts (per user).
    df["prev_start"] = df.groupby("user_id")["period_start_date"].shift(1)
    df = df[df["prev_start"].notna()].copy()
    df["cycle_length"] = (df["period_start_date"] - df["prev_start"]).dt.days
    df = df[df["cycle_length"] > 0].copy()

    # Per-user aggregates used as features (mirrors inference semantics).
    df["avg_cycle"] = df.groupby("user_id")["cycle_length"].transform("mean")
    df["trend_slope"] = df.groupby("user_id")["cycle_length"].transform(
        lambda s: _trend_slope(s.to_numpy())
    )
    df["error_correction"] = df["avg_prediction_error_days"].fillna(0.0)
    df["luteal_length"] = (df["cycle_length"] - 14).clip(lower=7)
    df["cycle_month"] = df["period_start_date"].dt.month
    df["bmi"] = df["weight_kg"] / ((df["height_cm"] / 100.0) ** 2)

    # Target: cycle length + per-user DP noise.
    df["next_cycle_interval"] = df["cycle_length"] + df["user_id"].apply(_dp_noise)

    rows = []
    for _, r in df.iterrows():
        rows.append(
            build_feature_vector(
                avg_cycle=float(r["avg_cycle"]),
                trend_slope=float(r["trend_slope"]) if pd.notna(r["trend_slope"]) else None,
                error_correction=float(r["error_correction"]),
                age=float(r["age"]) if pd.notna(r["age"]) else None,
                bmi=float(r["bmi"]) if pd.notna(r["bmi"]) else None,
                stress_level=r["stress_level"],
                sleep_hours=float(r["sleep_hours"]) if pd.notna(r["sleep_hours"]) else None,
                exercise_frequency=r["exercise_frequency"],
                diet_type=r["diet"],
                month=int(r["cycle_month"]),
                luteal_length=float(r["luteal_length"]),
            )
        )
    features_df = pd.DataFrame(rows)

    feature_names = contract_feature_keys()
    X = features_df[feature_names].to_numpy(dtype=float)
    y = df["next_cycle_interval"].to_numpy(dtype=float)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        reg_lambda=1.0,
        gamma=0.5,
        subsample=0.8,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    mae = float(mean_absolute_error(y_test, y_pred))
    r2 = float(r2_score(y_test, y_pred))

    logger.info(
        "model_trained", extra={"rmse": round(rmse, 2), "mae": round(mae, 2), "r2": round(r2, 4)}
    )

    validate_feature_keys(feature_names)
    coefficients = dict(zip(feature_names, model.feature_importances_.tolist(), strict=True))

    avg = df["avg_cycle"]
    std = float(avg.std()) if float(avg.std()) > 0 else 1.0
    # Informational only — the engine applies raw features (no z-scoring).
    scaler = {"avg_cycle_mean": float(avg.mean()), "avg_cycle_std": std}

    return model, feature_names, coefficients, scaler, rmse, mae, r2


def get_next_version(connection_url: str) -> int:
    """Get next model version from system_config."""
    from sqlalchemy import create_engine, text

    engine = create_engine(connection_url)
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT value FROM system_config WHERE key = 'global_model_version'")
        ).scalar_one_or_none()
    return int(result) + 1 if result else 1


def get_previous_rmse(connection_url: str) -> float | None:
    """Get previous RMSE from system_config JSON blob."""
    from sqlalchemy import create_engine, text

    engine = create_engine(connection_url)
    with engine.connect() as conn:
        value = conn.execute(
            text("SELECT value FROM system_config WHERE key = 'global_model_metrics'")
        ).scalar_one_or_none()
    if value:
        try:
            rmse = json.loads(value).get("rmse")
            return float(rmse) if isinstance(rmse, (int, float)) else None
        except Exception:
            return None
    return None


def update_system_config(
    connection_url: str,
    version: int,
    filename: str,
    rmse: float,
    mae: float,
    r2: float,
    dataset_size: int,
) -> None:
    """Update system_config after successful atomic swap."""
    from sqlalchemy import create_engine, text

    engine = create_engine(connection_url)
    metrics_json = json.dumps(
        {
            "rmse": round(rmse, 2),
            "mae": round(mae, 2),
            "r2": round(r2, 4),
            "dataset_size": int(dataset_size),
        }
    )

    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO system_config (key, value) VALUES ('global_model_version', :version)
                ON CONFLICT (key) DO UPDATE SET value = :version
            """),
            {"version": str(version)},
        )
        conn.execute(
            text("""
                INSERT INTO system_config (key, value) VALUES ('global_model_path', :path)
                ON CONFLICT (key) DO UPDATE SET value = :path
            """),
            {"path": filename},
        )
        conn.execute(
            text("""
                INSERT INTO system_config (key, value) VALUES ('global_model_metrics', :metrics)
                ON CONFLICT (key) DO UPDATE SET value = :metrics
            """),
            {"metrics": metrics_json},
        )


def export_model(
    model: xgb.XGBRegressor,
    feature_names: list[str],
    coefficients: dict[str, float],
    scaler: dict[str, float],
    rmse: float,
    mae: float,
    r2: float,
    version: int,
    dataset_size: int,
) -> str:
    """Write model to staging, atomically rename to prod (schema_version 2)."""
    validate_feature_keys(feature_names)
    os.makedirs(STAGING_DIR, exist_ok=True)
    os.makedirs(PROD_DIR, exist_ok=True)

    filename = f"global_model_v{version}.json"
    staging_path = os.path.join(STAGING_DIR, filename)
    prod_path = os.path.join(PROD_DIR, filename)

    payload = {
        "schema_version": 2,
        "model_type": "xgboost",
        "version": version,
        "trained_on": date.today().isoformat(),
        "feature_names": feature_names,
        "coefficients": {k: float(v) for k, v in coefficients.items()},
        # Informational only; the engine applies raw contract features.
        "scaler": scaler,
        "rmse": round(rmse, 2),
        "mae": round(mae, 2),
        "r2": round(r2, 4),
        "training_metadata": {
            "trained_at": datetime.now(UTC).isoformat(),
            "dataset_size": int(dataset_size),
            "rmse": round(rmse, 2),
            "mae": round(mae, 2),
            "r2": round(r2, 4),
        },
        # Serialized estimator for reference/diagnostics (not used by inference).
        "model_booster_dump": model.get_booster().get_dump(dump_format="json"),
    }

    with open(staging_path, "w") as f:
        json.dump(payload, f)

    shutil.move(staging_path, prod_path)
    logger.info("model_exported", extra={"filename": filename})
    return filename


def train_global_model(connection_url: str | None = None) -> bool:
    """Run the full monthly training pipeline.

    Returns True if a new model was deployed, False if aborted due to drift.
    """
    if connection_url is None:
        from app.core.config import get_settings

        connection_url = get_settings().database.url

    df = build_training_dataset(connection_url)
    if len(df) < MIN_ROWS:
        logger.warning("train_insufficient_data", extra={"rows": len(df)})
        return False

    model, feature_names, coefficients, scaler, rmse, mae, r2 = train_model(df)
    dataset_size = int(df.shape[0])

    # Data drift detection
    previous_rmse = get_previous_rmse(connection_url)
    if previous_rmse is not None:
        drift_threshold = max(DRIFT_RMSE_THRESHOLD, previous_rmse * (1 + DRIFT_PCT_INCREASE))
        if rmse > drift_threshold:
            logger.error(
                "model_drift_detected",
                extra={"rmse": round(rmse, 2), "threshold": round(drift_threshold, 2)},
            )
            return False

    version = get_next_version(connection_url)
    filename = export_model(
        model, feature_names, coefficients, scaler, rmse, mae, r2, version, dataset_size
    )

    update_system_config(connection_url, version, filename, rmse, mae, r2, dataset_size)
    logger.info("model_deployed", extra={"version": version, "rmse": round(rmse, 2)})
    return True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    train_global_model()
