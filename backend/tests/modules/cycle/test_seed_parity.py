"""Seed parity: backend `SYMPTOM_SEED` must match the mobile `symptoms.json` bundle.

Hard contract (DayDetailSheet plan §14.2 / DayDetailShee_plan.md §13.2): the
mobile app resolves symptoms by name from this bundle (offline-first), and the
backend `day_symptoms` stores UUIDs resolved by name. If the two drift, a user's
logged symptom can silently not round-trip. Freeze them together in the same PR.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.modules.cycle.seed import SYMPTOM_SEED

VALID_CATEGORIES = {"pain", "digestive", "skin", "general"}
VALID_ICON_KINDS = {"custom", "lucide"}

BACKEND_ROOT = Path(__file__).resolve().parents[4]
MOBILE_SYMPTOMS_JSON = BACKEND_ROOT / "mobile" / "src" / "assets" / "masters" / "symptoms.json"


def _backend_seed_by_name() -> dict[str, tuple[str, str, int]]:
    """name -> (category, icon, display_order) from the backend seed."""
    out: dict[str, tuple[str, str, int]] = {}
    for name, category, icon, order in SYMPTOM_SEED:
        assert category in VALID_CATEGORIES, f"seed category {category!r} invalid"
        assert order >= 1, f"seed display_order for {name!r} must start at 1"
        out[name] = (category, icon, order)
    return out


def _mobile_bundle() -> list[dict[str, object]]:
    if not MOBILE_SYMPTOMS_JSON.is_file():
        pytest.skip("mobile bundle not present — run from the repo checkout with /mobile")
    return json.loads(MOBILE_SYMPTOMS_JSON.read_text(encoding="utf-8"))


def _mobile_by_name(bundle: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    out: dict[str, dict[str, object]] = {}
    for row in bundle:
        name = row["name"]
        assert isinstance(name, str)
        assert row["category"] in VALID_CATEGORIES, f"bundle category invalid for {name}"
        if "icon_kind" in row:
            assert row["icon_kind"] in VALID_ICON_KINDS, f"icon_kind invalid for {name}"
        out[name] = row
    return out


def test_mobile_bundle_matches_backend_by_name_exactly() -> None:
    bundle = _mobile_bundle()
    mobile = _mobile_by_name(bundle)
    backend = _backend_seed_by_name()

    missing_in_mobile = sorted(set(backend) - set(mobile))
    extra_in_mobile = sorted(set(mobile) - set(backend))
    assert not missing_in_mobile, f"symptoms in backend seed but missing from mobile bundle: {missing_in_mobile}"
    assert not extra_in_mobile, f"symptoms in mobile bundle but not in backend seed: {extra_in_mobile}"

    assert len(bundle) == len(backend), "bundle row count must equal seed row count"


def test_master_category_and_display_order_match() -> None:
    bundle = _mobile_bundle()
    mobile = _mobile_by_name(bundle)
    backend = _backend_seed_by_name()

    for name, (category, _icon, order) in backend.items():
        row = mobile[name]
        assert row["category"] == category, f"{name}: category mismatch ({row['category']} != {category})"
        assert row["display_order"] == order, f"{name}: display_order mismatch ({row['display_order']} != {order})"


def test_display_order_resets_within_each_category() -> None:
    """§3 contract: display_order restarts at 1 for every category."""
    backend = _backend_seed_by_name()
    seen: dict[str, set[int]] = {}
    for name, (_category, _icon, order) in backend.items():
        category = backend[name][0]
        seen.setdefault(category, set()).add(order)
    for category, orders in seen.items():
        assert orders == set(range(1, len(orders) + 1)), f"{category}: display_order must be 1..N contiguous"
