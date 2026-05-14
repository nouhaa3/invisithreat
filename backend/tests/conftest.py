import sys
import os
from pathlib import Path

# Load environment variables from .env FIRST before any imports
from dotenv import load_dotenv

# Get backend directory
backend_dir = Path(__file__).parent.parent
env_path = backend_dir / ".env"

# Load .env file
if env_path.exists():
    load_dotenv(str(env_path), override=True)
    print(f"[OK] Loaded .env from: {env_path}")
else:
    print(f"[WARN] .env file not found at: {env_path}")

# Add backend to path
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Verify required env vars are loaded
required_vars = ["APP_NAME", "DATABASE_URL", "SECRET_KEY"]
missing = [v for v in required_vars if not os.environ.get(v)]
if missing:
    print(f"[WARN] Missing environment variables: {missing}")
else:
    print("[OK] All required environment variables loaded")

import pytest
from app.db.base import Base, import_models
from app.db.session import engine
from sqlalchemy.orm import Session


def pytest_configure(_):
    """
    Load environment variables before pytest collection.
    This runs before any test modules are collected.
    """
    # Ensure .env is loaded before pytest does collection
    if env_path.exists():
        load_dotenv(str(env_path), override=True)
    
    # Set defaults for any missing critical vars
    if not os.environ.get("APP_NAME"):
        os.environ["APP_NAME"] = "invisithreat"
    if not os.environ.get("DATABASE_URL"):
        os.environ["DATABASE_URL"] = "postgresql://localhost/invisithreat_test"
    if not os.environ.get("SECRET_KEY"):
        os.environ["SECRET_KEY"] = "test-secret-key-do-not-use-in-production"
    
    # Import all models and create tables before tests run
    import_models()
    Base.metadata.create_all(bind=engine)
    print("[OK] Test database tables created")


@pytest.fixture(scope="function")
def setup_db():
    """Create and clean up database tables for each test"""
    # Ensure all models are imported
    import_models()
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    yield
    
    # Drop all tables after test
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Database session for testing"""
    from app.db.session import SessionLocal
    
    # Create tables
    import_models()
    Base.metadata.create_all(bind=engine)
    
    # Create session
    from app.db.session import SessionLocal
    session = SessionLocal()
    
    yield session
    
    session.close()
    
    # Drop all tables with CASCADE
    from sqlalchemy import text, inspect
    with engine.begin() as connection:
        # Get all table names
        inspector = inspect(engine)
        for table_name in reversed(inspector.get_table_names()):
            connection.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE"))


@pytest.fixture
def client(db_session: Session):  # pylint: disable=redefined-outer-name
    """FastAPI test client"""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.db.session import get_db
    from typing import Any
    
    def override_get_db():  # pylint: disable=unused-variable
        yield db_session
    
    app_cast: Any = app  # type: ignore[assignment]  # pylint: disable=unused-variable
    app_cast.dependency_overrides[get_db] = override_get_db  # type: ignore[index,assignment]  # pylint: disable=no-member
    
    yield TestClient(app)
    
    app_cast.dependency_overrides.clear()  # type: ignore[index]  # pylint: disable=no-member


@pytest.fixture
def test_user(db_session: Session):  # pylint: disable=redefined-outer-name
    """Create a test user"""
    from app.models.user import User
    from app.models.role import Role
    from app.core.security import hash_password
    
    # Create role
    role = Role(name="Developer", description="Developer role")
    db_session.add(role)
    db_session.commit()
    
    # Create user
    user = User(
        email="test@example.com",
        hashed_password=hash_password("testpassword123"),
        role_id=role.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    return user


@pytest.fixture
def admin_user(db_session: Session):  # pylint: disable=redefined-outer-name
    """Create an admin test user"""
    from app.models.user import User
    from app.models.role import Role
    from app.core.security import hash_password
    
    # Create role
    role = Role(name="Admin", description="Admin role")
    db_session.add(role)
    db_session.commit()
    
    # Create user
    user = User(
        email="admin@example.com",
        hashed_password=hash_password("adminpassword123"),
        role_id=role.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    
    return user


@pytest.fixture
def auth_headers(test_user):  # pylint: disable=redefined-outer-name
    """Get authentication headers with valid JWT"""
    from app.core.jwt import create_access_token
    
    token = create_access_token(data={"sub": test_user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(admin_user):  # pylint: disable=redefined-outer-name
    """Get authentication headers for admin user"""
    from app.core.jwt import create_access_token
    
    token = create_access_token(data={"sub": admin_user.email})
    return {"Authorization": f"Bearer {token}"}
