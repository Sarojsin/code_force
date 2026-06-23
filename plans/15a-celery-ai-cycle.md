# Implementation Plan 12: Celery Tasks - AI and Cycle

## Objective
Implement Celery tasks for sentiment analysis and cycle prediction.

## Steps

### 12.1 Celery setup
- Configure Celery with Redis broker and result backend.
- Define queues: priority, default, ai.
- Set soft/hard time limits.

### 12.2 Sentiment analysis task
- nalyze_journal_sentiment: fetch entry, call Hugging Face, update DB.
- Idempotent using journal_entry_id; skip if analyzed within 1 hour.
- Retry on timeout/rate limit with 60s, 300s, 900s backoff.

### 12.3 Cycle prediction task
- update_cycle_predictions: daily 2 AM beat schedule.
- Compute averages from >=3 entries; use 28-day default otherwise.
- Upsert predicted_cycles for all users.

### 12.4 Monitoring
- Report task duration and outcome to Prometheus.
- Dead letter queue for failed tasks after max retries.

## Validation Criteria
- Sentiment task updates journal_entries correctly.
- Prediction task runs on schedule and stores results.
- Retry logic triggers on simulated failures.
