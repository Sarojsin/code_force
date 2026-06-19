SheCare Backend: Modular Design Rules
Follow these rules to ensure the backend is modular, maintainable, scalable, and testable. Each rule is a concrete guideline for organizing code, managing dependencies, and enforcing boundaries.

1. Package by Feature, Not by Layer
Rule 1.1 – Group related code by feature module (e.g., cycle, pregnancy, safety), not by technical layer (e.g., models, services, routers).

✅ Correct:

text
app/modules/cycle/
    ├── routes.py
    ├── models.py
    ├── services.py
    ├── schemas.py
    ├── dependencies.py
    └── tasks.py   # Celery tasks for this module
❌ Wrong:

text
app/models/      # all models together
app/routers/     # all endpoints together
app/services/    # all business logic together
Rule 1.2 – Each feature module must be self-contained. It can import from core/ (config, security, database) but should not import from other feature modules directly. Instead, use events or a shared service layer.

2. Clear Separation of Responsibilities
Rule 2.1 – Within a module, split code into:

File	Responsibility
models.py	SQLAlchemy ORM models (database tables)
schemas.py	Pydantic schemas (request/response validation)
services.py	Business logic, database queries, external calls
routes.py	HTTP endpoints (only request parsing, response formatting)
dependencies.py	FastAPI dependencies (e.g., get_current_user, get_db)
tasks.py	Celery background tasks related to the module
exceptions.py	Module-specific exception classes
Rule 2.2 – Routes (endpoints) must be thin – no business logic. Delegate to service functions.

✅ Good:

python
@router.post("/cycle/entries")
def create_entry(entry: CycleEntryCreate, db: Session = Depends(get_db)):
    return cycle_service.create_entry(db, entry)
❌ Bad:

python
@router.post("/cycle/entries")
def create_entry(entry: CycleEntryCreate, db: Session = Depends(get_db)):
    # 20 lines of validation, calculation, and DB logic here
    ...
Rule 2.3 – Services must not handle HTTP requests (no Request objects, no status codes). Return domain objects or raise custom exceptions.

3. Dependency Injection & Loose Coupling
Rule 3.1 – Use FastAPI’s dependency injection for all external dependencies: database sessions, Redis clients, external API clients (Twilio, Stream, FCM), configuration.

Rule 3.2 – Services should receive dependencies via constructor or function parameters, not by importing global instances.

✅ Good:

python
class CycleService:
    def __init__(self, db_session: Session, cache: Redis):
        self.db = db_session
        self.cache = cache
Rule 3.3 – Use dependencies.py to define reusable dependencies (e.g., get_current_user, get_cycle_service). Override them in tests.

4. Database & Schema Modularity
Rule 4.1 – Each module owns its database tables. Use separate Alembic migration files per module (prefix with module name: cycle_add_symptoms_jsonb.py).

Rule 4.2 – Foreign keys between modules are allowed, but never cascade delete across modules without explicit event handling. Use application-level soft deletes.

Rule 4.3 – Define all indexes, constraints, and JSONB fields inside the module’s models.py. Do not centralize database schema.

Rule 4.4 – Use UUID as primary key for all tables (except join tables) to avoid enumeration and enable distributed systems.

5. Configuration & Environment
Rule 5.1 – All configuration is in a single core/config.py using Pydantic BaseSettings. Group settings by concern (database, redis, twilio, etc.) using nested classes.

Rule 5.2 – No hardcoded values in modules. Everything configurable must come from settings.

Rule 5.3 – Secrets (API keys, passwords) are never committed; use environment variables or a secrets manager (AWS Secrets Manager). In development, use .env file (gitignored).

6. Error Handling & Exceptions
Rule 6.1 – Define module‑specific exception classes in exceptions.py. Each module may have:

ModuleNameError (base)

NotFoundError, ValidationError, ConflictError as needed.

Rule 6.2 – In routes.py, catch only module‑specific exceptions and convert to appropriate HTTP responses. Use a global exception handler for unhandled exceptions.

Rule 6.3 – Background tasks (Celery) must catch and log exceptions, then decide whether to retry based on exception type.

7. API Versioning & Schemas
Rule 7.1 – Version the API at the top level: /api/v1/.... Keep backward compatibility within a version. New features go into v2 if breaking.

Rule 7.2 – Pydantic schemas are split into:

*Create (for POST)

*Update (for PUT/PATCH, fields optional)

*Response (for GET responses, includes generated fields like id, created_at)

*InDB (internal, may contain sensitive fields not exposed)

Rule 7.3 – Never reuse the same schema for request and response unless trivial.

8. Background Tasks (Celery)
Rule 8.1 – Each module’s Celery tasks reside in tasks.py inside that module. Global tasks (e.g., cleanup) go in app/tasks/global_tasks.py.

Rule 8.2 – Tasks must be idempotent – running them twice should not cause inconsistency. Use task_id based on business key (e.g., f"analyze_journal_{journal_id}").

Rule 8.3 – Tasks must never call other tasks synchronously. Use chains, chords, or send_task with asynchronous result.

Rule 8.4 – Hard time limits (timeout) and soft time limits for all tasks to prevent worker starvation.

9. Testing Modularity
Rule 9.1 – Test files mirror the module structure: tests/modules/cycle/test_services.py, tests/modules/cycle/test_routes.py.

Rule 9.2 – Each module’s tests run in isolation – use a test database and test Redis that are cleared between modules. Do not rely on data created by another module’s tests.

Rule 9.3 – Mock external services (Twilio, Stream, FCM) at the module boundary using pytest-mock. Do not mock internal service functions – use real instances with test database.

Rule 9.4 – Provide a conftest.py per module for fixtures specific to that module.

10. Event-Driven Communication Between Modules
Rule 10.1 – Modules do not import each other’s services. Instead, emit events using a simple in‑memory event bus (or Redis pub/sub for distributed deployment).

Example: When a cycle module detects a new period start, it emits `event_bus.emit("period_started", user_id=...)". Other modules (pregnancy, emotional) can subscribe.

Rule 10.2 – Event subscribers are defined in the subscriber’s module, not in the emitter’s module. Use a registry pattern.

Rule 10.3 – For async events (outside HTTP request), use Celery tasks triggered by the event bus.

11. Dependency Management
Rule 11.1 – Use poetry or pip-tools for deterministic dependencies. Pin all direct and transitive dependencies.

Rule 11.2 – Separate dependencies:

main – runtime

dev – testing, linting, formatting

deploy – gunicorn, uvicorn

Rule 11.3 – Update dependencies weekly via Dependabot; test before merging.

12. Logging & Observability
Rule 12.1 – Use structured logging (JSON) with structlog. Add request_id and user_id (if authenticated) to each log entry.

Rule 12.2 – Different log levels:

INFO – API request start/end (without body), background task completion.

DEBUG – SQL queries (only in development), external API request/responses.

WARNING – Rate limit hit, retryable failure.

ERROR – Exception, external service permanently down.

Rule 12.3 – Each module can have its own logger named app.modules.<module_name>. Use logging.getLogger(__name__).

13. API Documentation
Rule 13.1 – Use FastAPI’s automatic OpenAPI. Add summary, description, and response_description to every endpoint.

Rule 13.2 – Document Pydantic schemas with Field(description="..."). Include example values.

Rule 13.3 – Keep openapi.json under version control (auto-generated on CI). Review changes to detect breaking API changes.

14. Security Rules Within Modules
Rule 14.1 – Each module that accesses user data must enforce row-level permission – never trust user_id from request body; always use current_user.id from authentication.

Rule 14.2 – Encryption/decryption of sensitive fields (e.g., journal content) happens in the service layer, not in routes or models. Use a shared encryption_service from core.

Rule 14.3 – Rate limiting is applied per endpoint in routes.py using a decorator @rate_limit(limit=100, window=60). Configuration per module can be defined in module’s dependencies.py.

15. Module Initialization & Lifespan
Rule 15.1 – Each module can define an init_module(app, event_bus) function that registers routes, event subscribers, and startup/shutdown hooks. Called from main app/__init__.py.

Rule 15.2 – Modules must be pluggable – commenting out a module’s import should not break the rest of the application. Use optional dependencies (try/except import).

16. Code Formatting & Linting
Rule 16.1 – Use black for formatting, isort for import ordering, ruff for linting (replaces flake8, pylint). Pre-commit hook enforces these.

Rule 16.2 – Maximum line length: 100 characters.

Rule 16.3 – Type hints are mandatory for all function arguments and return types. Use mypy in strict mode.

17. Database Migration Rules
Rule 17.1 – Migrations are generated by Alembic, one per logical change. Never edit an existing migration after it has been committed to main.

Rule 17.2 – Migrations must be reversible (downgrade defined) unless it’s a destructive change (e.g., dropping a column) – then document and plan.

Rule 17.3 – Run migrations as part of deployment before starting the new code version that depends on the new schema.

18. External API Integration (Twilio, Stream, FCM)
Rule 18.1 – Wrap each external API in a client class (e.g., TwilioClient, StreamClient) located in app/integrations/. The rest of the code only uses these client classes.

Rule 18.2 – Client classes must implement retry logic, circuit breaker, and timeout – not the calling module.

Rule 18.3 – Integration modules are configured via settings and registered in core/dependencies.py as singletons.

19. Folder Structure Compliance
Adhere to this structure:

text
app/
├── core/                     # Shared infrastructure
│   ├── config.py
│   ├── database.py
│   ├── security.py
│   ├── event_bus.py
│   ├── encryption.py
│   └── exceptions.py
├── integrations/             # External service wrappers
│   ├── twilio.py
│   ├── stream_chat.py
│   ├── fcm.py
│   └── huggingface.py
├── modules/                  # Feature modules
│   ├── auth/
│   ├── users/
│   ├── cycle/
│   ├── wellness/             # Emotional wellness + journal
│   ├── pregnancy/
│   ├── safety/
│   ├── family/
│   ├── nurse_content/
│   └── chat/                 # Only invite links + token (Stream wrapper)
├── tasks/                    # Global background tasks (cleanup, etc.)
│   └── global_cleanup.py
├── main.py                   # FastAPI app factory
└── lifespan.py               # Startup/shutdown logic
tests/
├── conftest.py
├── core/
├── integrations/
├── modules/
│   ├── cycle/
│   │   ├── test_routes.py
│   │   ├── test_services.py
│   │   └── test_tasks.py
│   └── ...
└── tasks/
20. Enforcement & Review
Rule 20.1 – Code reviews must verify adherence to these rules. Create a checklist for reviewers.

Rule 20.2 – CI pipeline runs ruff, mypy, and pytest – fails if any module violates import rules (e.g., importing another module’s service directly). Use import-linter to enforce boundaries.

Rule 20.3 – Document any deviation from these rules in an Architecture Decision Record (ADR) with justification.

Following these rules will keep your backend modular, testable, and ready for future features (voice journal, hospital integration) without rewriting everything. Each module can be developed, tested, and deployed independently – a true microservices mindset within a monorepo.