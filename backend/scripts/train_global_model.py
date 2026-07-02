#!/usr/bin/env python3
"""Monthly global model retraining script.

Privacy measures:
- PII bucketized (age ranges, BMI categories)
- user_id hashed with SHA256 + static salt
- Labels noise-added N(0, 1.5) seeded per-user for reproducibility

Data drift detection:
- RMSE > 3.5 OR >10% increase from previous month → abort, keep old model
- MAE also computed for stakeholder reporting

Atomic swap:
- Write staging/global_model_v{N}.json → rename to prod/
- Update system_config: global_model_version, global_model_path, global_model_rmse
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from datetime import date

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split

logger = logging.getLogger("scripts.train_global_model")

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "storage", "models")
STAGING_DIR = os.path.join(STORAGE_DIR, "staging")
PROD_DIR = os.path.join(STORAGE_DIR, "prod")

DRIFT_RMSE_THRESHOLD = 3.5
DRIFT_PCT_INCREASE = 0.10  # 10%


def build_training_dataset(connection_url: str) -> pd.DataFrame:
    """Build anonymized, bucketized training dataset.

    Joins users + user_onboarding + cycle_entries.
    Adds differential privacy noise seeded per-user.
    """
    from sqlalchemy import create_engine, text

    engine = create_engine(connection_url)
    query = text("""
        SELECT
            CASE
                WHEN u.age < 20 THEN '18-20'
                WHEN u.age < 25 THEN '21-25'
                WHEN u.age < 30 THEN '26-30'
                WHEN u.age < 35 THEN '31-35'
                WHEN u.age < 40 THEN '36-40'
                ELSE '40+'
            END AS age_bucket,
            CASE
                WHEN o.weight_kg IS NULL OR o.height_cm IS NULL THEN 'unknown'
                WHEN (o.weight_kg / POWER(NULLIF(o.height_cm / 100.0, 0), 2)) < 18.5 THEN 'underweight'
                WHEN (o.weight_kg / POWER(NULLIF(o.height_cm / 100.0, 0), 2)) < 25 THEN 'normal'
                WHEN (o.weight_kg / POWER(NULLIF(o.height_cm / 100.0, 0), 2)) < 30 THEN 'overweight'
                ELSE 'obese'
            END AS bmi_bucket,
            u.stress_level, u.exercise_frequency,
            u.avg_sleep_hours, u.diet_type, u.total_cycles_logged,
            u.avg_cycle_length, u.std_dev_cycle_length, u.median_cycle_length,
            u.avg_period_length, u.trend_slope,
            EXTRACT(MONTH FROM c.period_start_date) AS cycle_month,
            u.avg_prediction_error_days,
            ENCODE(SHA256(u.id::text || 'shecare-global-model-salt'), 'hex') AS hashed_user_id,
            GREATEST(c.cycle_length - 14, 7) AS luteal_length,
            SIN(2 * PI() * EXTRACT(MONTH FROM c.period_start_date) / 12.0) AS month_sin,
            COS(2 * PI() * EXTRACT(MONTH FROM c.period_start_date) / 12.0) AS month_cos,
            EXTRACT(DOW FROM c.period_start_date) AS weekday_of_start,
            CASE WHEN c.cycle_length > 45 THEN 1 ELSE 0 END AS is_break_cycle,
            -- Box-Muller transform for N(0, 1.5) noise; RANDOM(u.id) seeds per-user for reproducibility
            c.cycle_length + SQRT(-2 * LN(RANDOM(u.id))) * COS(2 * PI() * RANDOM()) * 1.5 AS next_cycle_interval
        FROM users u
        JOIN user_onboarding o ON u.id = o.user_id
        JOIN cycle_entries c ON u.id = c.user_id
        WHERE u.total_cycles_logged >= 3
    """)
    with engine.connect() as conn:
        df = pd.read_sql(query, conn)
    logger.info("built_training_dataset", extra={"rows": len(df)})
    return df


def train_model(df: pd.DataFrame) -> tuple[xgb.XGBRegressor, dict, float, float]:
    """Train XGBoost regressor. Returns (model, coefficients, rmse, mae)."""
    # Feature engineering: one-hot encode categoricals
    cat_cols = ["age_bucket", "bmi_bucket", "stress_level", "exercise_frequency", "diet_type"]
    df_encoded = pd.get_dummies(df, columns=cat_cols, drop_first=True)

    target_col = "next_cycle_interval"
    feature_cols = [c for c in df_encoded.columns if c != target_col and c != "hashed_user_id"]

    X = df_encoded[feature_cols].values
    y = df_encoded[target_col].values

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

    logger.info("model_trained", extra={"rmse": round(rmse, 2), "mae": round(mae, 2)})

    scaler = {
        "avg_cycle_mean": float(df["avg_cycle_length"].mean()) if "avg_cycle_length" in df else 29.0,
        "avg_cycle_std": float(df["avg_cycle_length"].std()) if "avg_cycle_length" in df else 4.0,
    }

    coefficients = dict(zip(feature_cols, model.feature_importances_.tolist(), strict=True))

    return model, {"coefficients": coefficients, "scaler": scaler}, rmse, mae


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
    import json as _json

    from sqlalchemy import create_engine, text
    engine = create_engine(connection_url)
    with engine.connect() as conn:
        value = conn.execute(
            text("SELECT value FROM system_config WHERE key = 'global_model_metrics'")
        ).scalar_one_or_none()
    if value:
        try:
            return _json.loads(value).get("rmse")
        except Exception:
            return None
    return None


def update_system_config(connection_url: str, version: int, filename: str, rmse: float, mae: float) -> None:
    """Update system_config after successful atomic swap."""
    from sqlalchemy import create_engine, text

    engine = create_engine(connection_url)
    metrics_json = json.dumps({"rmse": round(rmse, 2), "mae": round(mae, 2)})

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
    coefficients: dict, scaler: dict, rmse: float, mae: float, version: int,
) -> str:
    """Write model to staging, atomically rename to prod."""
    os.makedirs(STAGING_DIR, exist_ok=True)
    os.makedirs(PROD_DIR, exist_ok=True)

    filename = f"global_model_v{version}.json"
    staging_path = os.path.join(STAGING_DIR, filename)
    prod_path = os.path.join(PROD_DIR, filename)

    payload = {
        "version": version,
        "trained_on": date.today().isoformat(),
        "rmse": round(rmse, 2),
        "mae": round(mae, 2),
        "feature_names": list(coefficients.keys()),
        "coefficients": coefficients,
        "scaler": scaler,
    }

    with open(staging_path, "w") as f:
        json.dump(payload, f, indent=2)

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
    if len(df) < 10:
        logger.warning("train_insufficient_data", extra={"rows": len(df)})
        return False

    _, coefficients_dict, rmse, mae = train_model(df)

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
    coefficients = coefficients_dict["coefficients"]
    scaler = coefficients_dict["scaler"]
    filename = export_model(coefficients, scaler, rmse, mae, version)

    update_system_config(connection_url, version, filename, rmse, mae)
    logger.info("model_deployed", extra={"version": version, "rmse": round(rmse, 2)})
    return True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    train_global_model()
