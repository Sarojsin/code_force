"""Auth module — OTP / JWT / MFA / sessions.

Plan 04 (canonical) + plan 03 partials. Each file follows backend rule §2.1:

    models.py      ORM tables (users, user_sessions, otp_attempts)
    schemas.py     Pydantic Create/Update/Response/InDB
    services.py    business logic
    routes.py      thin HTTP endpoints
    dependencies.py FastAPI dependencies (get_current_user, get_auth_service)
    tasks.py       Celery (e.g. account anonymization)
    exceptions.py  AuthError + subtypes
"""
