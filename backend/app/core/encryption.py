"""Token encryption utilities using dedicated ENCRYPTION_KEY."""
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)

# Key ring structure placeholder for future rotation.
# Current implementation uses the first configured active key only.
KEY_RING_VERSION = "v1"


def _build_cipher(explicit_key: Optional[str] = None) -> Fernet:
    raw_key = (explicit_key or settings.ENCRYPTION_KEY or "").strip()
    if not raw_key:
        raise ValueError("ENCRYPTION_KEY is required for token encryption")
    return Fernet(raw_key.encode())


def validate_encryption_configuration() -> None:
    """Fail fast on startup if ENCRYPTION_KEY is missing/invalid."""
    raw_key = (settings.ENCRYPTION_KEY or "").strip()
    if not raw_key:
        raise ValueError("ENCRYPTION_KEY is required and must be a valid Fernet key")
    # Fernet() validates key format.
    Fernet(raw_key.encode())


def is_encrypted_token(value: Optional[str]) -> bool:
    if not value:
        return False
    return value.startswith("gAAAAA")


def encrypt_token(token: Optional[str], explicit_key: Optional[str] = None) -> Optional[str]:
    if not token:
        return None
    token = token.strip()
    if not token:
        return None
    cipher = _build_cipher(explicit_key)
    return cipher.encrypt(token.encode()).decode()


def decrypt_token(token_value: Optional[str], explicit_key: Optional[str] = None) -> Optional[str]:
    """
    Safe decrypt-on-read:
    - returns plaintext as-is for legacy records
    - decrypts Fernet values when applicable
    """
    if not token_value:
        return None
    token_value = token_value.strip()
    if not token_value:
        return None
    if not is_encrypted_token(token_value):
        return token_value
    try:
        cipher = _build_cipher(explicit_key)
        return cipher.decrypt(token_value.encode()).decode()
    except InvalidToken:
        logger.warning("Invalid encrypted token payload")
        return None
