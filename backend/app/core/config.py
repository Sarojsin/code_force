"""Application configuration.

Single source of truth, grouped by concern via nested settings classes.
Secrets come from environment variables (see .env.example).
Backend rules §5.
"""

import os
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Single source of truth for the model artifact directory (mlops_retrain_plan.md §3).
# Resolves to <backend>/storage/models from app/core/config.py.
MODEL_STORAGE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "storage",
    "models",
)


class DatabaseSettings(BaseSettings):
    url: str = Field(default="postgresql+asyncpg://shecare:shecare@localhost:5432/shecare")
    pool_size: int = 10
    max_overflow: int = 5
    pool_pre_ping: bool = True
    echo: bool = False


class RedisSettings(BaseSettings):
    url: str = Field(default="redis://localhost:6379/0")
    rate_limit_url: str = Field(default="redis://localhost:6379/1")
    celery_broker_url: str = Field(default="redis://localhost:6379/2")
    celery_result_backend: str = Field(default="redis://localhost:6379/3")


class JWTSettings(BaseSettings):
    secret_key: str = Field(default="dev-only-change-me")
    refresh_secret_key: str = Field(default="dev-only-change-me")
    algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7


class TwilioSettings(BaseSettings):
    account_sid: str = ""
    auth_token: str = ""
    verify_service_sid: str = ""
    from_number: str = ""


class FCMSettings(BaseSettings):
    service_account_json_path: str = ""


class StreamSettings(BaseSettings):
    api_key: str = ""
    api_secret: str = ""


class S3Settings(BaseSettings):
    endpoint_url: str = ""  # empty => use real AWS; set to MinIO URL in dev
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    bucket_videos: str = "shecare-videos"
    bucket_avatars: str = "shecare-avatars"
    bucket_diary_media: str = "shecare-diary-media"
    region: str = "ap-south-1"


class AdminSettings(BaseSettings):
    email: str = "admin@shecare.app"
    password: str = "Admin@123456"


class HuggingFaceSettings(BaseSettings):
    api_token: str = ""
    sentiment_model: str = "distilbert-base-uncased-finetuned-sst-2-english"
    inference_url: str = "https://api-inference.huggingface.co/models"


class GroqSettings(BaseSettings):
    api_key: str = ""
    model: str = "llama-3.3-70b-versatile"  # faster/cheaper: llama-3.1-8b-instant
    inference_url: str = "https://api.groq.com/openai/v1/chat/completions"
    max_tokens: int = 900
    temperature: float = 0.3
    enabled: bool = False  # off => deterministic rule-based cycle reports


class CloudinarySettings(BaseSettings):
    cloud_name: str = ""
    api_key: str = ""
    api_secret: str = ""


class EncryptionSettings(BaseSettings):
    master_key: str = Field(default="dev-only-fernet-key-replace-in-prod")
    pbkdf2_iterations: int = 600_000


class SafetySettings(BaseSettings):
    escalation_email: str = "safety-alerts@shecare.example"
    pagerduty_routing_key: str = ""
    max_contacts_per_user: int = 5
    sms_rate_limit_per_hour: int = 5
    sos_idempotency_window_hours: int = 24


class SentrySettings(BaseSettings):
    dsn: str = ""
    traces_sample_rate: float = 0.1
    profiles_sample_rate: float = 0.05


class CycleSettings(BaseSettings):
    auto_link_window_days: int = 3
    period_default_length: int = 5


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Literal["development", "staging", "production", "test"] = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])
    # TrustedHost allow-list (admin_dashboard_plan.md §B — critical). Default ["*"]
    # in dev; production deployments MUST set ALLOWED_HOSTS to the real host list
    # (e.g. ["api.shecare.app", "admin.shecare.app"]) — see main.py.
    allowed_hosts: list[str] = Field(default_factory=lambda: ["*"])

    # Sub-settings, populated from env with prefix, e.g. DATABASE__URL=...
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    jwt: JWTSettings = Field(default_factory=JWTSettings)
    twilio: TwilioSettings = Field(default_factory=TwilioSettings)
    fcm: FCMSettings = Field(default_factory=FCMSettings)
    stream: StreamSettings = Field(default_factory=StreamSettings)
    s3: S3Settings = Field(default_factory=S3Settings)
    admin: AdminSettings = Field(default_factory=AdminSettings)
    huggingface: HuggingFaceSettings = Field(default_factory=HuggingFaceSettings)
    groq: GroqSettings = Field(default_factory=GroqSettings)
    cloudinary: CloudinarySettings = Field(default_factory=CloudinarySettings)
    encryption: EncryptionSettings = Field(default_factory=EncryptionSettings)
    safety: SafetySettings = Field(default_factory=SafetySettings)
    sentry: SentrySettings = Field(default_factory=SentrySettings)
    cycle: CycleSettings = Field(default_factory=CycleSettings)


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance. Override via dependency in tests."""
    return Settings()
