"""Regression tests for the shared feature contract + prediction engine.

Covers (mlops_retrain_plan.md section 2):
  - contract_feature_keys() returns a stable 17-key ordered contract
  - build_feature_vector() always emits every one-hot flag (exactly one active)
  - validate_feature_keys() rejects a drifted contract
  - is_valid_global_model() accepts schema_version-2 artifacts and rejects legacy
  - _load_global_model() falls back (None) on invalid artifacts
  - apply_global_model() uses the shared builder, clamps confidence/prediction
"""

from __future__ import annotations

import json

import pytest

from app.integrations import prediction_engine as engine
from app.modules.cycle.feature_builder import (
    build_feature_vector,
    contract_feature_keys,
    validate_feature_keys,
)


def _valid_v2_artifact() -> dict:
    keys = contract_feature_keys()
    return {
        "schema_version": 2,
        "model_type": "xgboost",
        "version": 1,
        "feature_names": keys,
        "coefficients": {k: 1.0 / len(keys) for k in keys},
        "scaler": {"avg_cycle_mean": 28.0, "avg_cycle_std": 1.0},
        "rmse": 3.1,
        "training_metadata": {"rmse": 3.1},
    }


def test_contract_feature_keys_stable_17() -> None:
    keys = contract_feature_keys()
    assert len(keys) == 17
    assert keys == list(dict.fromkeys(keys)), "keys must not repeat"


def test_build_feature_vector_emits_all_one_hot_flags() -> None:
    fv = build_feature_vector(
        avg_cycle=28.0,
        trend_slope=None,
        error_correction=0.0,
        age=30,
        bmi=22.0,
        stress_level="moderate",
        sleep_hours=7.0,
        exercise_frequency="moderate",
        diet_type="balanced",
        month=8,
        luteal_length=14.0,
    )
    assert list(fv.keys()) == contract_feature_keys()
    exercise_flags = [fv[k] for k in ("exercise_low", "exercise_moderate", "exercise_high")]
    diet_flags = [fv[k] for k in ("diet_balanced", "diet_normal", "diet_junk")]
    assert sum(exercise_flags) == 1.0, "exactly one exercise one-hot active"
    assert sum(diet_flags) == 1.0, "exactly one diet one-hot active"


def test_build_feature_vector_ordinal_equivalent_to_raw() -> None:
    raw = build_feature_vector(
        avg_cycle=28.0,
        age=30,
        bmi=22.0,
        stress_level="low",
        sleep_hours=7.0,
        exercise_frequency="high",
        diet_type="normal",
        month=3,
        luteal_length=13.0,
    )
    from app.modules.cycle.feature_builder import age_to_ordinal, bmi_to_ordinal

    ordinal = build_feature_vector(
        avg_cycle=28.0,
        age_bucket=age_to_ordinal(30),
        bmi_bucket=bmi_to_ordinal(22.0),
        stress_level="low",
        sleep_hours=7.0,
        exercise_frequency="high",
        diet_type="normal",
        month=3,
        luteal_length=13.0,
    )
    assert raw == ordinal


def test_validate_feature_keys_rejects_drift() -> None:
    with pytest.raises(ValueError):
        validate_feature_keys(["avg_cycle", "trend_slope"])


def test_validate_feature_keys_accepts_contract() -> None:
    validate_feature_keys(contract_feature_keys())


def test_is_valid_global_model_accepts_v2() -> None:
    assert engine.is_valid_global_model(_valid_v2_artifact()) is True


def test_is_valid_global_model_rejects_legacy_dump() -> None:
    legacy = {"schema_version": 1, "model_booster_dump": "xgboost dump string"}
    assert engine.is_valid_global_model(legacy) is False
    assert engine.is_valid_global_model(None) is False
    assert engine.is_valid_global_model({}) is False


def test_load_global_model_returns_none_for_invalid_artifact(tmp_path, monkeypatch) -> None:
    prod = tmp_path / "prod"
    prod.mkdir()
    (prod / "global_model_v1.json").write_text("{not valid json")
    monkeypatch.setattr(engine, "PROD_DIR", str(prod))
    assert engine._load_global_model(version=1) is None


def test_load_global_model_loads_valid_v2(tmp_path, monkeypatch) -> None:
    prod = tmp_path / "prod"
    prod.mkdir()
    (prod / "global_model_v1.json").write_text(json.dumps(_valid_v2_artifact()))
    monkeypatch.setattr(engine, "PROD_DIR", str(prod))
    loaded = engine._load_global_model(version=1)
    assert loaded is not None
    assert engine.is_valid_global_model(loaded) is True


def test_apply_global_model_clamps_and_uses_shared_builder() -> None:
    model = _valid_v2_artifact()
    pred, conf = engine.apply_global_model(
        model=model,
        user_avg_cycle=28.0,
        user_std_cycle=3.0,
        user_trend_slope=None,
        user_avg_error=0.0,
        user_age_bucket_ordinal=2.0,
        user_bmi_bucket_ordinal=1.0,
        user_stress_level="moderate",
        user_avg_period_length=5,
        user_local_delta=0,
        user_sleep_hours=7.0,
        user_exercise_frequency="moderate",
        user_diet="balanced",
    )
    assert 20 <= pred <= 45
    assert 0.5 <= conf <= 0.95
    assert conf == 0.69  # 1 - (3.1/10), clamped


def test_apply_global_model_missing_coefficient_defaults_zero() -> None:
    model = _valid_v2_artifact()
    del model["coefficients"]["diet_junk"]
    pred, conf = engine.apply_global_model(
        model=model,
        user_avg_cycle=28.0,
        user_std_cycle=3.0,
        user_trend_slope=None,
        user_avg_error=0.0,
        user_age_bucket_ordinal=2.0,
        user_bmi_bucket_ordinal=1.0,
        user_stress_level="low",
        user_avg_period_length=5,
        user_local_delta=0,
        user_sleep_hours=7.0,
        user_exercise_frequency="low",
        user_diet="junk",
    )
    assert 20 <= pred <= 45
    assert 0.5 <= conf <= 0.95
