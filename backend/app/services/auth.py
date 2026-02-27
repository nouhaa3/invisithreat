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
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return user


def register_user(db: Session, user_data: UserCreate) -> User:
    """
    Register a new user
    
    Args:
        db: Database session
        user_data: User registration data
    
    Returns:
        Created user object
    
    Raises:
        HTTPException: If email already exists or role not found
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Get role by name
    role = db.query(Role).filter(Role.name == user_data.role_name).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{user_data.role_name}' not found"
        )
    
    # Create new user
    new_user = User(
        id=uuid.uuid4(),
        nom=user_data.nom,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role_id=role.id,
        is_active=True
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
    
    return {
        "id": user.id,
        "email": user.email,
        "nom": user.nom,
        "profile_picture": user.profile_picture,
        "date_creation": user.date_creation,
        "is_active": user.is_active,
        "role_id": user.role_id,
        "role_name": role.name if role else None,
        "role_description": role.description if role else None
    }
