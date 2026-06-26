"""Application configuration.

Single source of truth, grouped by concern via nested settings classes.
Secrets come from environment variables (see .env.example).
Backend rules §5.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    region: str = "ap-south-1"


class HuggingFaceSettings(BaseSettings):
    api_token: str = ""
    sentiment_model: str = "distilbert-base-uncased-finetuned-sst-2-english"
    inference_url: str = "https://api-inference.huggingface.co/models"


class EncryptionSettings(BaseSettings):
    master_key: str = Field(default="dev-only-fernet-key-replace-in-prod")
    pbkdf2_iterations: int = 600_000


class WellnessModelSettings(BaseSettings):
    version: str = "1.0.0"
    model_dir: str = "./models/wellness-classifier"
    checksum_sha256: str = ""
    onnx_filename: str = "wellness_classifier.onnx"


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

    # Sub-settings, populated from env with prefix, e.g. DATABASE__URL=...
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    jwt: JWTSettings = Field(default_factory=JWTSettings)
    twilio: TwilioSettings = Field(default_factory=TwilioSettings)
    fcm: FCMSettings = Field(default_factory=FCMSettings)
    stream: StreamSettings = Field(default_factory=StreamSettings)
    s3: S3Settings = Field(default_factory=S3Settings)
    huggingface: HuggingFaceSettings = Field(default_factory=HuggingFaceSettings)
    encryption: EncryptionSettings = Field(default_factory=EncryptionSettings)
    safety: SafetySettings = Field(default_factory=SafetySettings)
    sentry: SentrySettings = Field(default_factory=SentrySettings)
    wellness_model: WellnessModelSettings = Field(default_factory=WellnessModelSettings)


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance. Override via dependency in tests."""
    return Settings()
