"""Application-level encryption for sensitive fields (journal content, medical notes).

Backend rules:
- §14.2: encrypt/decrypt in the service layer; this module is the shared helper
- §5.3: master key from settings, never hardcoded
- Per-user key derivation via PBKDF2 (per_user_salt from users.encryption_key_salt)
- Envelope encryption ready: master key can be rotated without re-encrypting data
"""

from __future__ import annotations

import base64
import uuid
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.core.config import EncryptionSettings, get_settings


class EncryptionError(Exception):
    """Raised when encryption or decryption fails (key mismatch, tampered data)."""


def _derive_user_key(master_key: str, salt: str, iterations: int) -> bytes:
    """Derive a 32-byte user-specific key from the master key + per-user salt."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt.encode("utf-8"),
        iterations=iterations,
    )
    derived = kdf.derive(master_key.encode("utf-8"))
    return base64.urlsafe_b64encode(derived)


def make_user_salt() -> str:
    """Generate a fresh per-user salt. Stored in users.encryption_key_salt."""
    return base64.urlsafe_b64encode(uuid.uuid4().bytes).decode("ascii")


class EncryptionService:
    """Encrypt / decrypt byte-strings or text using a per-user Fernet key."""

    def __init__(self, settings: EncryptionSettings | None = None) -> None:
        self._settings = settings or get_settings().encryption

    def encrypt_for_user(self, plaintext: str, user_salt: str) -> str:
        if not plaintext:
            return ""
        key = _derive_user_key(
            self._settings.master_key,
            user_salt,
            self._settings.pbkdf2_iterations,
        )
        return Fernet(key).encrypt(plaintext.encode("utf-8")).decode("ascii")

    def decrypt_for_user(self, token: str, user_salt: str) -> str:
        if not token:
            return ""
        key = _derive_user_key(
            self._settings.master_key,
            user_salt,
            self._settings.pbkdf2_iterations,
        )
        try:
            return Fernet(key).decrypt(token.encode("ascii")).decode("utf-8")
        except InvalidToken as exc:
            raise EncryptionError("Ciphertext tampered or wrong user salt") from exc


@lru_cache
def get_encryption_service() -> EncryptionService:
    return EncryptionService()
