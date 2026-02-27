from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from app.db.session import get_db
from app.schemas.auth import LoginResponse, Token, RefreshTokenRequest
from app.schemas.user import UserCreate, UserWithRole
from app.services.auth import authenticate_user, register_user, get_user_with_role
from app.core.jwt import create_access_token, create_refresh_token, decode_token, get_current_user
from app.core.config import settings
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new user account
    
    Creates a new user with hashed password and returns JWT tokens
    """
    # Register user
    user = register_user(db, user_data)
    
    # Get user with role information
    user_with_role = get_user_with_role(db, user)
    
    # Create tokens
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user_with_role["role_name"]}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id)}
    )
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserWithRole(**user_with_role)
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login with email and password
    
    OAuth2 compatible endpoint that returns JWT tokens
    """
    # Authenticate user
    user = authenticate_user(db, form_data.username, form_data.password)
    
    # Get user with role information
    user_with_role = get_user_with_role(db, user)
    
    # Create tokens
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user_with_role["role_name"]}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id)}
    )
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserWithRole(**user_with_role)
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token
    
    Returns new access and refresh tokens
    """
    try:
        # Decode refresh token
        payload = decode_token(refresh_request.refresh_token)
        
        # Verify it's a refresh token
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Get user to verify they still exist and are active
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Get role for new access token
        user_with_role = get_user_with_role(db, user)
        
        # Create new tokens
        new_access_token = create_access_token(
            data={"sub": str(user.id), "role": user_with_role["role_name"]}
        )
        new_refresh_token = create_refresh_token(
            data={"sub": str(user.id)}
        )
        
        return Token(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate token"
        )


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user)
):
    """
    Logout current user
    
    Note: JWT tokens are stateless, so logout is handled client-side
    by deleting the tokens. This endpoint confirms the token is valid.
    """
    return {
        "message": "Successfully logged out",
        "detail": "Please delete tokens from client storage"
    }


@router.get("/me", response_model=UserWithRole)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user information
    
    Protected route that requires valid JWT token
    """
    user_with_role = get_user_with_role(db, current_user)
    return UserWithRole(**user_with_role)
