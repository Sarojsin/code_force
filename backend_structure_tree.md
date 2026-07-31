backend/
├── 📂 .expo/
│   ├── 📝 README.md
│   └── 🧾 settings.json
├── 📂 .mypy_cache/
│   ├── 📂 3.11/
│   │   ├── 📄 cache.0.db
│   │   ├── 📄 cache.1.db
│   │   ├── 📄 cache.10.db
│   │   ├── 📄 cache.11.db
│   │   ├── 📄 cache.12.db
│   │   ├── 📄 cache.13.db
│   │   ├── 📄 cache.14.db
│   │   ├── 📄 cache.15.db
│   │   ├── 📄 cache.2.db
│   │   ├── 📄 cache.3.db
│   │   ├── 📄 cache.4.db
│   │   ├── 📄 cache.5.db
│   │   ├── 📄 cache.6.db
│   │   ├── 📄 cache.7.db
│   │   ├── 📄 cache.8.db
│   │   ├── 📄 cache.9.db
│   │   └── 📄 cache.db
│   ├── 📄 .gitignore
│   └── 📄 CACHEDIR.TAG
├── 📂 .ruff_cache/
│   ├── 📂 0.15.18/
│   │   ├── 📄 10047465087096740458
│   │   ├── 📄 10964607605569924361
│   │   ├── 📄 11807125853258209907
│   │   ├── 📄 12536336051954581562
│   │   ├── 📄 13776848379748280022
│   │   ├── 📄 14236502020642889873
│   │   ├── 📄 14379156579381828260
│   │   ├── 📄 15028280029253559553
│   │   ├── 📄 15356365965327540379
│   │   ├── 📄 15690916646343106994
│   │   ├── 📄 15874315730049980434
│   │   ├── 📄 17083526993251310600
│   │   ├── 📄 17486771763653982909
│   │   ├── 📄 2640832589956608446
│   │   ├── 📄 2746877669418958015
│   │   ├── 📄 3521625753462411193
│   │   ├── 📄 3847708540771049510
│   │   ├── 📄 4770402086338149706
│   │   ├── 📄 4786738116211096960
│   │   ├── 📄 6225817737567170741
│   │   ├── 📄 6929606911715333273
│   │   ├── 📄 7801494787568183693
│   │   └── 📄 9897289233055447330
│   ├── 📂 0.3.7/
│   │   ├── 📄 1350458671984212629
│   │   ├── 📄 15044728520182185099
│   │   └── 📄 9141047337213310172
│   ├── 📄 .gitignore
│   └── 📄 CACHEDIR.TAG
├── 🗃️ alembic/
│   ├── 📂 versions/
│   │   ├── 🐍 0001_auth_initial.py
│   │   ├── 🐍 0002_domain_tables.py
│   │   ├── 🐍 0003_add_composite_indexes.py
│   │   ├── 🐍 0004_auth_email_secret.py
│   │   ├── 🐍 0005_auth_last_login_failed_attempts.py
│   │   ├── 🐍 0006_onboarding_table.py
│   │   ├── 🐍 0007_user_ml_metrics.py
│   │   ├── 🐍 0008_correction_columns.py
│   │   ├── 🐍 0009_snooze_events.py
│   │   ├── 🐍 0010_unique_cycle_entry_constraint.py
│   │   ├── 🐍 0011_prediction_model_fields.py
│   │   ├── 🐍 0012_system_config.py
│   │   ├── 🐍 0013_add_journal_analyses.py
│   │   ├── 🐍 0014_safety_phase4.py
│   │   ├── 🐍 0015_add_checkin_sent.py
│   │   ├── 🐍 0016_cycle_add_cycle_type.py
│   │   ├── 🐍 0017_cycle_add_idempotency_key.py
│   │   ├── 🐍 2026_06_24_1344-911664c419c9_safety_contact_ids_json.py
│   │   ├── 🐍 2026_06_24_1443-7ccfe1b50f12_add_client_updated_at_to_syncable_tables.py
│   │   ├── 🐍 2026_07_01_1558-52433d5717b1_add_client_updated_at_to_user_onboarding.py
│   │   ├── 🐍 2026_07_02_1623-ea796595c9f5_wellness_add_title_mood_notes.py
│   │   └── 🐍 2026_07_22_0805-93a7172745d5_sync_models_to_db.py
│   ├── 🐍 env.py
│   └── 📄 script.py.mako
├── 📱 app/
│   ├── 🎯 core/
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 audit.py
│   │   ├── 🐍 celery_app.py
│   │   ├── 🐍 config.py
│   │   ├── 🐍 database.py
│   │   ├── 🐍 encryption.py
│   │   ├── 🐍 event_bus.py
│   │   ├── 🐍 exceptions.py
│   │   ├── 🐍 logging_config.py
│   │   ├── 🐍 monitoring.py
│   │   ├── 🐍 pagination.py
│   │   ├── 🐍 rate_limit.py
│   │   ├── 🐍 redis_client.py
│   │   ├── 🐍 responses.py
│   │   ├── 🐍 security.py
│   │   ├── 🐍 security_headers.py
│   │   ├── 🐍 sentry_middleware.py
│   │   └── 🐍 token_revocation.py
│   ├── 🔌 integrations/
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 fcm_client.py
│   │   ├── 🐍 huggingface_client.py
│   │   ├── 🐍 prediction_engine.py
│   │   ├── 🐍 s3_client.py
│   │   ├── 🐍 stream_client.py
│   │   └── 🐍 twilio_client.py
│   ├── 🧩 modules/
│   │   ├── 📂 admin/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   └── 🐍 services.py
│   │   ├── 📂 auth/
│   │   │   ├── 📂 plan/
│   │   │   │   ├── 📝 jwt_authplan.md
│   │   │   │   └── 📄 simple.txt
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   ├── 🐍 services.py
│   │   │   ├── 🐍 tasks.py
│   │   │   └── 📝 workflow.md
│   │   ├── 📂 chat/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   └── 🐍 services.py
│   │   ├── 📂 cycle/
│   │   │   ├── 📂 plan/
│   │   │   │   ├── 📝 cycle_rule_plan.md
│   │   │   │   └── 📝 cycle_rule_rawplan.md
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 phase_utils.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   ├── 🐍 services.py
│   │   │   └── 🐍 tasks.py
│   │   ├── 📂 diary/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   ├── 🐍 services.py
│   │   │   └── 🐍 tasks.py
│   │   ├── 📂 diary_assets/
│   │   │   ├── 🖼️ assets/
│   │   │   │   └── 📄 diary_assets_v1.0.0.zip
│   │   │   ├── 🐍 __init__.py
│   │   │   └── 🐍 routes.py
│   │   ├── 📂 family/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   ├── 🐍 services.py
│   │   │   └── 🐍 tasks.py
│   │   ├── 📂 luna/
│   │   │   ├── 🖼️ assets/
│   │   │   │   └── 📄 luna_assets_v1.1.0.zip
│   │   │   ├── 🐍 __init__.py
│   │   │   └── 🐍 routes.py
│   │   ├── 📂 nurse_content/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   └── 🐍 services.py
│   │   ├── 📂 onboarding/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   └── 🐍 services.py
│   │   ├── 📂 pregnancy/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   ├── 🐍 services.py
│   │   │   └── 🐍 tasks.py
│   │   ├── 📂 safety/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   ├── 🐍 services.py
│   │   │   └── 🐍 tasks.py
│   │   ├── 📂 sync/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   └── 🐍 services.py
│   │   ├── 📂 users/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   ├── 🐍 services.py
│   │   │   └── 🐍 tasks.py
│   │   ├── 📂 voice/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 routes.py
│   │   │   └── 🐍 schemas.py
│   │   ├── 📂 wellness/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 dependencies.py
│   │   │   ├── 🐍 exceptions.py
│   │   │   ├── 🐍 models.py
│   │   │   ├── 🐍 routes.py
│   │   │   ├── 🐍 schemas.py
│   │   │   ├── 🐍 seed.py
│   │   │   ├── 🐍 services.py
│   │   │   └── 🐍 tasks.py
│   │   └── 🐍 __init__.py
│   ├── 📋 tasks/
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 checkin.py
│   │   ├── 🐍 global_cleanup.py
│   │   └── 🐍 retention_cleanup.py
│   ├── 🐍 __init__.py
│   ├── 🐍 main.py
│   └── 🐍 seed.py
├── 🖼️ assets/
│   └── 🗄️ models/
├── 📚 docs/
│   ├── 📂 adr/
│   │   ├── 📝 0001-use-fastapi.md
│   │   ├── 📝 0002-client-side-encryption.md
│   │   ├── 📝 0003-event-bus.md
│   │   ├── 📝 0004-celery-over-pubsub.md
│   │   └── 📝 0005-stream-chat.md
│   ├── 📝 alerting-runbook.md
│   ├── 📝 data-retention.md
│   ├── 📝 rollback.md
│   └── 📝 staging-environment.md
├── 📋 plans/
│   └── 📝 gaps_plan1_report.md
├── 📜 scripts/
│   ├── 📄 fix_pg_hba.ps1
│   ├── 🐍 migrate_encryption.py
│   ├── 🐍 seed_test_users.py
│   ├── 🐍 train_global_model.py
│   └── 🐍 update_model_config.py
├── 🗄️ storage/
│   └── 🗄️ models/
│       └── 📂 prod/
│           └── 🧾 global_model_v1.json
├── 🧪 tests/
│   ├── 🔌 integrations/
│   │   ├── 🐍 __init__.py
│   │   └── 🐍 test_twilio.py
│   ├── 🧩 modules/
│   │   ├── 📂 admin/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   └── 🐍 test_services.py
│   │   ├── 📂 auth/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 conftest.py
│   │   │   ├── 🐍 test_extended_services.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   ├── 🐍 test_services.py
│   │   │   ├── 🐍 test_system_test8_scenarios.py
│   │   │   └── 🐍 test_tasks.py
│   │   ├── 📂 chat/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   └── 🐍 test_services.py
│   │   ├── 📂 cycle/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 system_test.py
│   │   │   ├── 🐍 test_extended_services.py
│   │   │   ├── 🐍 test_extra_services.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   ├── 🐍 test_services.py
│   │   │   ├── 🐍 test_system_test1_scenarios.py
│   │   │   ├── 🐍 test_system_test2_scenarios.py
│   │   │   ├── 🐍 test_system_test3_scenarios.py
│   │   │   ├── 🐍 test_system_test4_scenarios.py
│   │   │   ├── 🐍 test_system_test5_scenarios.py
│   │   │   ├── 🐍 test_system_test6_scenarios.py
│   │   │   ├── 🐍 test_system_test_scenarios.py
│   │   │   └── 🐍 test_tasks.py
│   │   ├── 📂 family/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 test_extended_services.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   ├── 🐍 test_services.py
│   │   │   └── 🐍 test_tasks.py
│   │   ├── 📂 nurse_content/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   └── 🐍 test_services.py
│   │   ├── 📂 onboarding/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   └── 🐍 test_services.py
│   │   ├── 📂 pregnancy/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   ├── 🐍 test_services.py
│   │   │   └── 🐍 test_tasks.py
│   │   ├── 📂 safety/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 test_extended_services.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   ├── 🐍 test_services.py
│   │   │   └── 🐍 test_tasks.py
│   │   ├── 📂 sync/
│   │   │   ├── 🐍 test_routes.py
│   │   │   └── 🐍 test_services.py
│   │   ├── 📂 system/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 test_system_test10_scenarios.py
│   │   │   ├── 🐍 test_system_test11_scenarios.py
│   │   │   ├── 🐍 test_system_test12_scenarios.py
│   │   │   ├── 🐍 test_system_test13_scenarios.py
│   │   │   ├── 🐍 test_system_test14_scenarios.py
│   │   │   ├── 🐍 test_system_test15_scenarios.py
│   │   │   ├── 🐍 test_system_test16_scenarios.py
│   │   │   └── 🐍 test_system_test9_scenarios.py
│   │   ├── 📂 users/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 test_export.py
│   │   │   ├── 🐍 test_extended_services.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   ├── 🐍 test_services.py
│   │   │   └── 🐍 test_tasks.py
│   │   ├── 📂 voice/
│   │   │   ├── 🐍 __init__.py
│   │   │   └── 🐍 test_routes.py
│   │   ├── 📂 wellness/
│   │   │   ├── 🐍 __init__.py
│   │   │   ├── 🐍 test_routes.py
│   │   │   ├── 🐍 test_services.py
│   │   │   └── 🐍 test_tasks.py
│   │   └── 🐍 __init__.py
│   ├── 📋 tasks/
│   │   └── 🐍 __init__.py
│   ├── 🐍 __init__.py
│   ├── 🐍 conftest.py
│   ├── 🐍 test_celery_app.py
│   ├── 🐍 test_encryption.py
│   ├── 🐍 test_event_bus.py
│   ├── 🐍 test_global_cleanup.py
│   ├── 🐍 test_health.py
│   ├── 🐍 test_logging_config.py
│   ├── 🐍 test_monitoring.py
│   ├── 🐍 test_pagination.py
│   ├── 🐍 test_rate_limit.py
│   ├── 🐍 test_responses.py
│   ├── 🐍 test_retention_cleanup.py
│   ├── 🐍 test_security.py
│   ├── 🐍 test_security_headers.py
│   ├── 🐍 test_sentry_middleware.py
│   └── 🐍 test_token_revocation.py
├── 📄 .coverage
├── 🔐 .env
├── 🔐 .env.example
├── 📄 .gitignore
├── 🧾 .pre-commit-config.yaml
├── 🐳 Dockerfile
├── 📄 Dockerfile.worker
├── 📝 README.md
├── 📄 admin_err.txt
├── ⚙️ alembic.ini
├── 📄 coverage_output.txt
├── 🐍 debug_pull.py
├── 🧾 docker-compose.yml
├── 🔒 poetry.lock
├── 📦 pyproject.toml
├── 🐍 run.py
├── 🐍 structure.py
├── 🐍 test_auth.py
├── 📜 uvicorn.log
├── 📜 uvicorn2.log
├── 📜 uvicorn3.log
└── 📜 uvicorn_err.log
