"""
Security utilities for password hashing and verification
"""
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Configure password hashing context with bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    """
    Hash a plain text password using bcrypt.
    
    Args:
        password: Plain text password to hash
        
    Returns:
        Hashed password string
        
    Example:
        >>> hashed = hash_password("my_secure_password")
        >>> print(hashed[:7])
        $2b$12$
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a hashed password.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password to compare against
        
    Returns:
        True if password matches, False otherwise
        
    Example:
        >>> hashed = hash_password("my_password")
        >>> verify_password("my_password", hashed)
        True
        >>> verify_password("wrong_password", hashed)
        False
    """
    return pwd_context.verify(plain_password, hashed_password)


# Mock user object for demonstration - in production use real user lookup
class MockUser:
    def __init__(self, id: int = 1, username: str = "demo_user", email: str = "demo@example.com"):
        self.id = id
        self.username = username
        self.email = email
        self.is_active = True


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> MockUser:
    """
    Get current user from JWT token.
    For now, returns a mock user for development.
    
    In production, this should:
    1. Validate JWT token signature
    2. Extract user ID from token
    3. Look up user in database
    4. Verify user is still active
    
    Args:
        credentials: HTTP Bearer token from Authorization header
        
    Returns:
        User object from database
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    try:
        # For development/testing, accept any bearer token and return mock user
        if not credentials.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Extract user_id from token (in production, validate JWT properly)
        # For now, just verify token is present
        user = MockUser(id=1, username="authenticated_user", email="user@example.com")
        return user
        
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )