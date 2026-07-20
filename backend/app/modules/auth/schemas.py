"""Pydantic schemas. Split per backend rule §7.2."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

PHONE_RE = re.compile(r"^\+[1-9]\d{6,14}$")  # E.164


# ----- request bodies -----


class OTPRequestCreate(BaseModel):
    phone: str = Field(..., description="E.164 phone number, e.g. +14155552671")

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, v: str) -> str:
        if not PHONE_RE.match(v):
            raise ValueError("phone must be E.164 format (e.g. +14155552671)")
        return v


class OTPVerifyCreate(BaseModel):
    phone: str
    otp: str = Field(..., min_length=4, max_length=8)
    device_info: dict | None = None

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, v: str) -> str:
        if not PHONE_RE.match(v):
            raise ValueError("phone must be E.164 format")
        return v


class RefreshTokenCreate(BaseModel):
    refresh_token: str
    device_info: dict | None = None


PASSWORD_SPECIAL_RE = re.compile(r"[!@#$%^&*(),.?\":{}|<>_\-+=~`\[\];']")
PASSWORD_NUMBER_RE = re.compile(r"[0-9]")


def _validate_password_strength(v: str) -> str:
    if len(v) < 8 or len(v) > 128:
        raise ValueError("Password must be between 8 and 128 characters")
    if not PASSWORD_NUMBER_RE.search(v):
        raise ValueError("Password must contain at least one number")
    if not PASSWORD_SPECIAL_RE.search(v):
        raise ValueError("Password must contain at least one special character")
    return v


class RegisterCreate(BaseModel):
    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str | None = Field(None, max_length=100)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class LoginCreate(BaseModel):
    email: str
    password: str = Field(..., min_length=1)
    device_info: dict | None = None


class PasswordLoginCreate(BaseModel):
    phone: str
    password: str = Field(..., min_length=8, max_length=128)
    device_info: dict | None = None


class PasswordSetCreate(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class PasswordChangeCreate(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class MFAEnableResponse(BaseModel):
    secret: str
    otpauth_uri: str


class MFAVerifyCreate(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)


class LogoutCreate(BaseModel):
    refresh_token: str | None = None  # optional: revoke this session too
    all_devices: bool = False


# ----- response bodies -----


class OTPRequestResponse(BaseModel):
    message: str = "OTP sent"
    expires_in: int = 300
    dev_code: str | None = None  # only populated in development / test


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str | None = None
    phone_number: str | None = None
    display_name: str | None
    role: Literal["user", "family", "nurse", "admin"]
    is_active: bool
    is_verified: bool = False
    provider: str = "local"
    created_at: datetime
    last_login_at: datetime | None = None
    onboarding_completed: bool = False


class LoginResponse(BaseModel):
    user: UserResponse
    tokens: TokenPair
    requires_mfa: bool = False


class MFALoginCreate(BaseModel):
    """Body for completing an MFA challenge."""

    mfa_token: str = Field(..., description="The short-lived access_token returned with the MFA challenge")
    code: str = Field(..., min_length=6, max_length=8)
    device_info: dict | None = None


class DeviceRegisterCreate(BaseModel):
    fcm_token: str = Field(..., min_length=1, max_length=500, description="Firebase Cloud Messaging token")
    platform: str = Field(..., pattern=r"^(ios|android)$")
    device_info: dict | None = None


class DeviceRegisterResponse(BaseModel):
    message: str = "Device registered"
    fcm_token_prefix: str
