from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password, verify_password
from app.schemas.user import UserCreate
import uuid


def authenticate_user(db: Session, email: str, password: str) -> User:
    """
    Authenticate user with email and password
    
    Args:
        db: Database session
        email: User email
        password: Plain text password
    
    Returns:
        User object if authentication successful
    
    Raises:
        HTTPException: If credentials are invalid
    """
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check email verification
    if not getattr(user, 'is_verified', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="EMAIL_NOT_VERIFIED"
        )
    
    if not user.is_active:
        if getattr(user, 'is_pending', False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="PENDING_APPROVAL"
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact the administrator."
        )
    
    return user


def register_user(db: Session, user_data: UserCreate) -> User:
    """
    Register a new user - always as VIEWER with email verification required
    
    Args:
        db: Database session
        user_data: User registration data (no role_name needed - always VIEWER)
    
    Returns:
        Created user object
    
    Raises:
        HTTPException: If email already exists or VIEWER role not found
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Get VIEWER role (all new users start here)
    viewer_role = db.query(Role).filter(Role.name == "Viewer").first()
    if not viewer_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Viewer role not configured"
        )
    
    # Create new user - VIEWER role, active, but NOT email verified yet
    new_user = User(
        id=uuid.uuid4(),
        nom=user_data.nom,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role_id=viewer_role.id,
        is_active=True,           # active from start (VIEWER access)
        is_pending=False,         # not pending (no old-style admin approval)
        is_verified=False,        # email NOT verified yet
        trial_scans_remaining=2   # trial scans for VIEWER
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


def get_user_with_role(db: Session, user: User) -> dict:
    """
    Get user data with role information
    
    Args:
        db: Database session
        user: User object
    
    Returns:
        Dictionary with user and role data
    """
    role = db.query(Role).filter(Role.id == user.role_id).first()
    requested_role = None
    if getattr(user, "requested_role_id", None):
        requested_role = db.query(Role).filter(Role.id == user.requested_role_id).first()
    
    return {
        "id": user.id,
        "email": user.email,
        "nom": user.nom,
        "profile_picture": user.profile_picture,
        "date_creation": user.date_creation,
        "is_active": user.is_active,
        "is_pending": user.is_pending if user.is_pending is not None else False,
        "is_verified": user.is_verified if user.is_verified is not None else False,
        "trial_scans_remaining": user.trial_scans_remaining if user.trial_scans_remaining is not None else 0,
        "requested_role_id": user.requested_role_id,
        "requested_role_name": requested_role.name if requested_role else None,
        "role_id": user.role_id,
        "role_name": role.name if role else None,
        "role_description": role.description if role else None
    }
