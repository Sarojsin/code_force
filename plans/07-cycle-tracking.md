# Implementation Plan 5: Cycle Tracking Module

## Objective
Build period logging, prediction computation, and analytics endpoints.

## Steps

### 5.1 Cycle entry CRUD
- POST/GET/PUT/DELETE /cycle/entries with pagination and date filters.
- Default list returns last 6 months.

### 5.2 Prediction computation
- Celery task update_cycle_predictions runs daily at 2 AM.
- Compute average cycle length (median/mode), predict next period and fertile window.
- Upsert into predicted_cycles table.
- Fallback to 28-day cycle when insufficient data.

### 5.3 Analytics
- GET /cycle/analytics: average cycle length, common symptoms, mood trends.
- Use efficient aggregation queries with indexes.

## Validation Criteria
- Entry CRUD works with correct date filtering.
- Predictions compute from >=3 entries.
- Analytics return expected aggregates.
