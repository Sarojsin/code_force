# Plan 2: Database Migrations

## Steps
1. Initialize Alembic and configure env.py for async SQLAlchemy.
2. Define Base model with id (UUID), created_at, updated_at, is_active soft-delete mixins.
3. Create all core tables: users, user_sessions, emergency_contacts.
4. Create domain tables: cycle_entries, predicted_cycles, journal_entries, mood_logs, breathing_exercises, user_exercise_sessions.
5. Create pregnancy tables: pregnancy_profiles, pregnancy_daily_logs, pregnancy_milestones.
6. Create safety tables: sos_alerts, sos_notification_attempts.
7. Create family tables: family_links.
8. Create nurse tables: nurse_profiles, educational_contents.
9. Create future stub: voice_journal_future.
10. Add audit_logs, user_consents.
11. Add indexes, CHECK constraints, GIN indexes on JSONB.

## Validation
- alembic upgrade head applies cleanly
- All tables exist with correct columns
