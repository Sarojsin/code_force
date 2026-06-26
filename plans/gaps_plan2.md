# Gap Plan 2: mypy Strict Errors (205 → 0)

> **Target:** `mypy --strict app/` passes with 0 errors
> **Current:** 205 errors across 63 files
> **Priority:** HIGH — CI gate blocks PRs

---

## 2.1 Error Profile

| Category | Count | Files Impacted | Fix Pattern |
|----------|-------|----------------|-------------|
| `[type-arg]` Missing type arguments | 57 | all modules | Add generic params: `list[str]` → `Sequence[str]`, `dict` → `dict[str, Any]` |
| `[no-untyped-def]` Missing type annotation | 35 | services, routes, tasks | Add return type + param types |
| `[untyped-decorator]` Decorator no type | 17 | routes (FastAPI decorators), celery tasks | `# type: ignore[misc]` or annotate decorator |
| `[list-item]` main.py module list | 13 | `app/main.py` | Type the module list as `list[ModuleType]` |
| `[import-not-found]` | 11 | monitoring, prediction_engine | Add `types-*` stubs or `type: ignore` |
| `[no-any-return]` | 11 | various | Cast or annotate the return |
| `[import-untyped]` | 9 | celery, boto3, firebase_admin | `types-celery`, `boto3-stubs`, `firebase-admin-stubs` |
| `[attr-defined]` | 6 | model queries (Result.rowcount) | `cast(int, result.rowcount)` |
| `[misc]` | 5 | various | Fix per-case |
| `[index]` | 4 | main.py state dict | Type state as `dict[str, Any]` |

---

## 2.2 Implementation Steps

### Step 1: Install missing stub packages (fixes ~20 errors)

```bash
poetry add --dev \
  types-python-dateutil \
  types-pytz \
  types-requests \
  boto3-stubs \
  mypy-boto3-s3 \
  types-redis \
  types-celery
```

**Expected fix:** `import-not-found` and `import-untyped` for `celery`, `boto3`, `firebase_admin`

### Step 2: Fix `app/main.py` (28 errors — the worst file)

| Line | Error | Fix |
|------|-------|-----|
| Module list assignment | `[list-item]` | `modules: list[ModuleType] = [...]` |
| `state` dict access | `[index]` | `state: dict[str, Any] = {}` and `cast(Redis, state["redis"])` |
| Lifespan context | `[no-untyped-def]` | `async def lifespan(app: FastAPI) -> AsyncIterator[None]:` |
| Middleware registration | `[untyped-decorator]` | `# type: ignore[arg-type]` on `add_middleware` calls |

### Step 3: Fix `[type-arg]` errors across all files (57 errors — bulk edit)

**Pattern:** Find all unparameterized generics and add type arguments.

| Raw Type | Fix | Occurrences |
|----------|-----|-------------|
| `dict` | `dict[str, Any]` | 15 |
| `list` | `list[str]` or `list[dict[str, Any]]` | 12 |
| `Optional` | `Optional[str]` (was `Optional` alone) | 8 |
| `Callable` | `Callable[..., Awaitable[Any]]` | 5 |
| `Type` | `Type[BaseModel]` | 4 |
| `tuple` | `tuple[str, ...]` | 3 |
| `set` | `set[str]` | 2 |
| `Iterator` | `Iterator[dict[str, Any]]` | 2 |
| `Generator` | `Generator[Any, None, None]` | 2 |
| `Sequence` | `Sequence[tuple[str, int]]` | 2 |
| `Mapping` | `Mapping[str, Any]` | 1 |
| `Awaitable` | `Awaitable[None]` | 1 |

**Scripted approach:**
```bash
# Create a grep list of files with [type-arg] errors
mypy --strict app/ 2>&1 | grep "type-arg" | cut -d: -f1 | sort -u
# Then fix each file individually
```

### Step 4: Fix `[no-untyped-def]` (35 errors — 1 error per function)

**Priority order by file:**
| File | Count | Functions to Annotate |
|------|-------|----------------------|
| `cycle/services.py` | 5 | `_compute_heuristic`, `_compute_median`, `_linear_regression`, `_rf_fallback`, `_get_day_types` |
| `safety/services.py` | 4 | `_send_fcm_notification`, `_check_idempotency`, `_resolve_expired`, `_log_checkin` |
| `auth/services.py` | 3 | `_hash_password`, `_verify_password`, `_generate_mfa_code` |
| `sync/services.py` | 3 | `_merge_conflict`, `_last_writer_wins`, `_get_sync_diff` |
| `users/services.py` | 2 | `_anonymize_user`, `_collect_user_data` |
| `prediction_engine.py` | 3 | `_heuristic`, `_median_model`, `_linear_regression_model` |
| Remaining files | 15 | 1-2 each |

**Pattern for each:**
```python
# Before:
def _compute_heuristic(self, history):
    ...

# After:
def _compute_heuristic(self, history: list[CycleEntry]) -> float | None:
    ...
```

### Step 5: Fix `[no-any-return]` (11 errors)

**Root cause:** A function annotated as returning `Any` (implicitly via untyped decorator) or returning the result of a call that returns `Any`.

| Fix Pattern | Examples |
|-------------|----------|
| `return cast(Response, await call())` | Route handlers with FastAPI decorators |
| `return typed_result # type: ignore[no-any-return]` | When upstream lib returns `Any` (e.g., `boto3`) |
| Add explicit return type to the function | When the annotation was missing entirely |

### Step 6: Fix `[attr-defined]` on SQLAlchemy result objects (6 errors)

```python
# Before:
count = result.rowcount  # error: "Result" has no attribute "rowcount"

# After:
from sqlalchemy.engine import CursorResult
count = cast(CursorResult, result).rowcount
```

### Step 7: Suppress unavoidable errors with `type: ignore`

| Situation | Annotation |
|-----------|------------|
| FastAPI `@router.get(...)` decorators | `# type: ignore[misc]` |
| Celery `@app.task(...)` decorators | `# type: ignore[arg-type]` |
| SQLAlchemy `select(...)` on dynamic models | `# type: ignore[type-arg]` |
| Pydantic v1/v2 compatibility shims | `# type: ignore[union-attr]` |
| Third-party lib without stubs (firebase_admin) | `# type: ignore[import-untyped]` on import |

---

## 2.3 Execution Script (Day-by-Day)

```bash
# Day 1: Install stubs + fix main.py
poetry add --dev types-python-dateutil types-pytz types-requests boto3-stubs mypy-boto3-s3 types-redis types-celery
# Fix app/main.py (28 errors)

# Day 2: Bulk fix [type-arg] (57 errors — same fix pattern throughout)
# Use sed/grep to find all untyped dict/list/Optional/Callable in app/

# Day 3: Fix [no-untyped-def] (35 errors — one per function)
# Cycle + safety + auth + sync + users + prediction_engine

# Day 4: Fix [no-any-return] + [attr-defined] + [misc] + [index]
# ~26 remaining errors

# Day 5: Add type: ignore for unavoidable cases
# Rerun mypy --strict app/, fix remaining
```

---

## 2.4 Validation

```bash
mypy --strict app/  # Must return 0 errors
pytest -x --tb=short  # No regressions from type changes
```
