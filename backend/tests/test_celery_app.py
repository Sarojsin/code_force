from app.core.celery_app import celery_app


def test_celery_app_name() -> None:
    assert celery_app.main == "shecare"


def test_celery_app_has_beat_schedule() -> None:
    assert hasattr(celery_app.conf, "beat_schedule")
    schedule = celery_app.conf.beat_schedule
    assert "retention-cleanup-daily" in schedule


def test_celery_app_has_timezone() -> None:
    assert celery_app.conf.timezone == "UTC"


def test_celery_app_has_task_routes() -> None:
    assert hasattr(celery_app.conf, "task_routes")


def test_celery_app_task_serializer() -> None:
    assert celery_app.conf.task_serializer == "json"


def test_celery_app_has_includes() -> None:
    assert "app.tasks.retention_cleanup" in celery_app.conf.include
