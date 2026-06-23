# Implementation Plan 26: Background Job Scheduler

## Objective
Schedule recurring Celery Beat tasks for periodic background work.

## Steps

### 26.1 Beat schedule
- update_cycle_predictions: daily 2 AM.
- prune_expired_tokens: daily 3 AM.
- generate_weekly_insights: Sundays.
- check_pregnancy_reminders: daily 9 AM.
- cleanup_family_link_tokens: hourly.

### 26.2 Dynamic scheduling
- Allow ad-hoc task triggers from API for non-recurring jobs.
- Use Celery canvas (chains, chords) for SOS subtasks.

### 26.3 Monitoring
- Expose beat schedule in admin metrics.
- Alert if scheduled tasks miss expected run window.

## Validation Criteria
- Beat schedule file is valid.
- Scheduled tasks execute at expected times.
