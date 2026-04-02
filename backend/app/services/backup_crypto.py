from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


PBKDF2_ITERATIONS = 390_000


def encrypt_bytes(payload: bytes, password: str) -> tuple[bytes, bytes]:
    salt = os.urandom(16)
    return _fernet(password, salt).encrypt(payload), salt


def decrypt_bytes(payload: bytes, password: str, salt: bytes | None) -> bytes:
    if not salt:
        raise ValueError("Encrypted backup is missing its salt metadata.")
    try:
        return _fernet(password, salt).decrypt(payload)
    except (InvalidToken, ValueError) as exc:
        raise ValueError("Backup password is invalid.") from exc


def encode_bytes(value: bytes | None) -> str | None:
    if value is None:
        return None
    return base64.b64encode(value).decode("ascii")


def decode_bytes(value: str | None) -> bytes | None:
    if not value:
        return None
    return base64.b64decode(value.encode("ascii"))


def sha256_hex(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _fernet(password: str, salt: bytes) -> Fernet:
    if not password:
        raise ValueError("A backup password is required.")
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
        dklen=32,
    )
    return Fernet(base64.urlsafe_b64encode(key))

