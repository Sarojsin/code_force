# Data Retention Policy

| Data Type | Retention Period | Deletion Mechanism |
|-----------|-----------------|---------------------|
| Journal entries | 2 years after last edit | Soft delete → hard delete after 2y |
| Mood logs | 2 years | Hard delete after 2y |
| Cycle entries | 5 years | Soft delete → hard delete after 5y |
| SOS alerts | 90 days | Hard delete after 90d |
| Emergency contacts | Until user deletes or account closed | Hard delete on user request |
| Audit logs | 90 days | Hard delete (Celery: `prune_audit_logs`) |
| OTP attempts | 30 days | Hard delete |
| User sessions | 1 year after last activity | Hard delete |
| Chat messages | Not stored (Stream Chat) | Deleted via Stream Chat API on account close |
| Medical notes | Until user deletes | Hard delete on user request |
| FCM tokens | Until token invalid or user removed | Hard delete on token refresh |
| Consents | Permanent | Never deleted (legal requirement) |
| User account | Until soft-delete + 30 day grace | Hard delete after 30 day grace period |
| Pregnancy data | 1 year after due date | Soft delete → hard delete |
| Family links | Until revoked | Soft delete; hard delete after 1y of revocation |

## Implementation
- Soft-deleted records are excluded from all queries via `is_active = False`.
- Hard-delete Celery tasks run daily (see `app/modules/users/tasks.py`).
- User consent records are never hard-deleted.
