"""Encryption roundtrip test (plan 03 / 03b)."""

import pytest

from app.core.encryption import EncryptionError, EncryptionService, make_user_salt


def test_per_user_keys_differ() -> None:
    svc = EncryptionService()
    salt_a = make_user_salt()
    salt_b = make_user_salt()
    token_a = svc.encrypt_for_user("hello", salt_a)
    token_b = svc.encrypt_for_user("hello", salt_b)
    assert token_a != token_b


def test_roundtrip() -> None:
    svc = EncryptionService()
    salt = make_user_salt()
    encrypted = svc.encrypt_for_user("journal text", salt)
    decrypted = svc.decrypt_for_user(encrypted, salt)
    assert decrypted == "journal text"


def test_wrong_user_salt_fails() -> None:
    svc = EncryptionService()
    encrypted = svc.encrypt_for_user("secret", make_user_salt())
    with pytest.raises(EncryptionError):
        svc.decrypt_for_user(encrypted, make_user_salt())
