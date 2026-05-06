"""
Example usage of token encryption in GitHub scanner service.

This file demonstrates how the encryption methods are used in production.
"""

# -----------------------------------------------------------------------------
# EXAMPLE 1: Creating a GitHub Repository Link with OAuth Token
# -----------------------------------------------------------------------------

from app.api.routes.integrations import _exchange_github_code_for_token
from app.models.github_repository import GitHubRepository
from app.services.project import get_project_accessible
from sqlalchemy.orm import Session
import uuid

async def example_github_oauth_handler(
    payload_code: str,
    project_id: uuid.UUID,
    db: Session,
):
    """
    When user completes GitHub OAuth, we get a token and need to store it.
    Encryption happens automatically.
    """
    # Exchange OAuth code for access token
    token_data = _exchange_github_code_for_token(payload_code)
    plaintext_token = token_data["access_token"]
    
    # Create repository record
    repo = GitHubRepository(
        project_id=project_id,
        name="my-repo",
        url="https://github.com/myorg/myrepo",
        default_branch="main"
    )
    
    # ? Encrypts automatically before storage
    repo.set_access_token(plaintext_token)
    
    db.add(repo)
    db.commit()
    
    print(f"? Token encrypted and stored. Encrypted length: {len(repo.access_token_encrypted)}")
    # Output: ? Token encrypted and stored. Encrypted length: 188


# -----------------------------------------------------------------------------
# EXAMPLE 2: Using Token in Background Scan Task
# -----------------------------------------------------------------------------

from app.services.github_scanner import run_github_scan

def example_trigger_scan(db: Session, project_id: uuid.UUID):
    """
    When starting a GitHub scan, the token is automatically decrypted.
    """
    # Look up the repository
    repo = db.query(GitHubRepository).filter(
        GitHubRepository.project_id == project_id
    ).first()
    
    if not repo:
        return None
    
    # ? Decrypts automatically
    plaintext_token = repo.get_access_token()
    
    if not plaintext_token:
        print("? Token decryption failed or token is None")
        return None
    
    print(f"? Token decrypted successfully (length: {len(plaintext_token)})")
    # Output: ? Token decrypted successfully (length: 40)
    
    # Token is now plaintext in memory, use for GitHub API
    clone_url = f"https://x-access-token:{plaintext_token}@github.com/myorg/myrepo"
    return clone_url


# -----------------------------------------------------------------------------
# EXAMPLE 3: Low-Level Encryption/Decryption
# -----------------------------------------------------------------------------

from app.core.encryption import encrypt_token, decrypt_token
from app.core.config import settings

def example_direct_encryption():
    """
    Direct use of encryption functions (advanced).
    """
    plaintext = "ghp_16C7e42F292c6912E7710c838347Ae178B4a"
    
    # Encrypt
    encrypted = encrypt_token(plaintext, settings.encryption_key)
    print(f"Original length: {len(plaintext)}, Encrypted length: {len(encrypted)}")
    # Output: Original length: 40, Encrypted length: 188
    
    # Encrypted token is base64-encoded Fernet ciphertext
    print(f"Encrypted (first 50 chars): {encrypted[:50]}...")
    # Output: Encrypted (first 50 chars): gAAAAABlrX2i5j2kL9m...
    
    # Decrypt
    decrypted = decrypt_token(encrypted, settings.encryption_key)
    assert decrypted == plaintext
    print("? Roundtrip encryption/decryption successful")


# -----------------------------------------------------------------------------
# EXAMPLE 4: Handling Decryption Failures
# -----------------------------------------------------------------------------

from app.core.encryption import decrypt_token

def example_error_handling(encrypted_blob: str):
    """
    Decryption gracefully returns None on failure (doesn't raise).
    """
    plaintext = decrypt_token(encrypted_blob, settings.encryption_key)
    
    if plaintext is None:
        print("?? Decryption failed. Possible causes:")
        print("  - SECRET_KEY changed since encryption")
        print("  - Encrypted data corrupted")
        print("  - Wrong encryption key used")
        return None
    
    print(f"? Decryption successful: {plaintext}")
    return plaintext


# -----------------------------------------------------------------------------
# EXAMPLE 5: Migrating Old Plaintext Tokens
# -----------------------------------------------------------------------------

from app.db.session import SessionLocal

def example_migrate_old_tokens():
    """
    One-time migration of plaintext tokens to encrypted.
    Run this once after deployment.
    """
    db = SessionLocal()
    try:
        repos = db.query(GitHubRepository).all()
        migrated = 0
        
        for repo in repos:
            # Old plaintext column might still have data during transition
            if hasattr(repo, "access_token") and repo.access_token:
                # Encrypt and store in new column
                repo.set_access_token(repo.access_token)
                migrated += 1
        
        db.commit()
        print(f"? Migrated {migrated} repositories")
    finally:
        db.close()


# -----------------------------------------------------------------------------
# EXAMPLE 6: Testing (Unit Test)
# -----------------------------------------------------------------------------

import pytest

def test_github_token_encryption_roundtrip():
    """Test that tokens can be encrypted and decrypted correctly."""
    from app.core.encryption import encrypt_token, decrypt_token
    from app.core.config import settings
    
    # Test data
    original_token = "ghp_16C7e42F292c6912E7710c838347Ae178B4a"
    encryption_key = settings.encryption_key
    
    # Encrypt
    encrypted = encrypt_token(original_token, encryption_key)
    assert encrypted is not None
    assert encrypted != original_token
    assert len(encrypted) > len(original_token)
    
    # Decrypt
    decrypted = decrypt_token(encrypted, encryption_key)
    assert decrypted == original_token
    print("? Test passed: encryption/decryption roundtrip works")


def test_github_repository_token_methods():
    """Test GitHubRepository encryption methods."""
    from app.models.github_repository import GitHubRepository
    
    repo = GitHubRepository(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        name="test-repo",
        url="https://github.com/test/repo",
    )
    
    # Set encrypted token
    test_token = "ghp_test123abc"
    repo.set_access_token(test_token)
    
    assert repo.access_token_encrypted is not None
    assert repo.access_token_encrypted != test_token
    
    # Get decrypted token
    retrieved = repo.get_access_token()
    assert retrieved == test_token
    print("? Test passed: GitHubRepository encryption methods work")


def test_token_encryption_with_wrong_key():
    """Test that decryption fails gracefully with wrong key."""
    from app.core.encryption import encrypt_token, decrypt_token
    
    token = "ghp_my_secret_token"
    key1 = "correct-key-32-characters-long"
    key2 = "wrong-key-totally-different-key"
    
    encrypted = encrypt_token(token, key1)
    decrypted = decrypt_token(encrypted, key2)  # Wrong key
    
    assert decrypted is None  # Should return None, not raise
    print("? Test passed: wrong key returns None gracefully")


# -----------------------------------------------------------------------------
# USAGE SUMMARY
# -----------------------------------------------------------------------------
"""
DO:
? Use repo.set_access_token(token) to store tokens
? Use repo.get_access_token() to retrieve tokens
? Use encrypt_token/decrypt_token for direct encryption
? Handle None returns from decrypt_token gracefully
? Keep SECRET_KEY safe and secret
? Rotate tokens periodically

DON'T:
? Store plaintext tokens directly in DB
? Log tokens or encrypted tokens
? Share SECRET_KEY with anyone
? Change SECRET_KEY without re-encrypting tokens
? Assume decryption always succeeds (always check for None)
"""
