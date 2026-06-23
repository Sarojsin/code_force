# Plan 1: Project Setup

## Steps
1. Initialize Python 3.11+ project with FastAPI, SQLAlchemy, Alembic, Celery, pydantic-settings.
2. Create directory structure: app/{models,schemas,routers,services,tasks,middleware,utils,core}, tests/, alembic/, docs/.
3. Configure docker-compose with Postgres, Redis, MinIO.
4. Add Dockerfiles for API and worker.
5. Set up GitHub Actions CI: ruff lint, pytest, build, push to ECR, deploy to ECS.

## Validation
- docker-compose up starts all services
- uvicorn app.main:app --reload serves on port 8000
- /docs auto-generated Swagger UI loads
