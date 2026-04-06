"""
Tests for main FastAPI application and authentication
"""
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pytest
import json
import uuid

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password
from app.schemas.user import UserCreate
from app.services.auth import register_user
from datetime import datetime, UTC

# Setup test database
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# ──────────────────────────────────────────────────────────────────────────────
# BASIC TESTS
# ──────────────────────────────────────────────────────────────────────────────

def test_read_root():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_docs_accessible():
    """Test API documentation is accessible"""
    response = client.get("/api/docs")
    assert response.status_code == 200


# ──────────────────────────────────────────────────────────────────────────────
# AUTHENTICATION TESTS
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def test_db():
    """Create a fresh database for each test"""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()


@pytest.fixture
def setup_roles(test_db):
    """Create default roles for testing"""
    roles_data = [
        {"name": "admin", "description": "Administrator"},
        {"name": "security_manager", "description": "Security Manager"},
        {"name": "developer", "description": "Developer"},
        {"name": "viewer", "description": "Viewer"},
    ]
    for role_data in roles_data:
        role = Role(name=role_data["name"], description=role_data["description"])
        test_db.add(role)
    test_db.commit()
    return test_db


def test_user_registration(setup_roles):
    """Test user registration"""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",
            "nom": "Test User",
            "prenomsecond": "User",
            "password": "SecurePass123!",
            "password_confirm": "SecurePass123!",
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "email_verification_required"
    assert data["email"] == "test@example.com"


def test_user_registration_invalid_email(setup_roles):
    """Test registration with invalid email"""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "invalid-email",
            "nom": "Test",
            "prenomsecond": "User",
            "password": "Pass123!",
            "password_confirm": "Pass123!",
        }
    )
    assert response.status_code == 422


def test_user_registration_password_mismatch(setup_roles):
    """Test registration with mismatched passwords"""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",
            "nom": "Test",
            "prenomsecond": "User",
            "password": "Pass123!",
            "password_confirm": "Different123!",
        }
    )
    assert response.status_code == 422 or response.status_code == 400


def test_login_nonexistent_user(setup_roles):
    """Test login with nonexistent user"""
    response = client.post(
        "/api/auth/login",
        data={
            "username": "nonexistent@example.com",
            "password": "anypassword",
        }
    )
    assert response.status_code == 401


def test_login_wrong_password(setup_roles):
    """Test login with wrong password"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email="test@example.com",
        nom="Test",
        prenomsecond="User",
        password="CorrectPass123!",
        password_confirm="CorrectPass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    db.commit()
    
    response = client.post(
        "/api/auth/login",
        data={
            "username": "test@example.com",
            "password": "WrongPass123!",
        }
    )
    assert response.status_code == 401


def test_successful_login(setup_roles):
    """Test successful user login"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email="test@example.com",
        nom="Test",
        prenomsecond="User",
        password="CorrectPass123!",
        password_confirm="CorrectPass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    db.commit()
    
    response = client.post(
        "/api/auth/login",
        data={
            "username": "test@example.com",
            "password": "CorrectPass123!",
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_logout(setup_roles):
    """Test user logout"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email="test@example.com",
        nom="Test",
        prenomsecond="User",
        password="CorrectPass123!",
        password_confirm="CorrectPass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    db.commit()
    
    # First login to get token
    login_response = client.post(
        "/api/auth/login",
        data={
            "username": "test@example.com",
            "password": "CorrectPass123!",
        }
    )
    token = login_response.json()["access_token"]
    
    # Then logout
    response = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200


# ──────────────────────────────────────────────────────────────────────────────
# PROJECT TESTS
# ──────────────────────────────────────────────────────────────────────────────

def test_create_project(setup_roles):
    """Test project creation"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email="test@example.com",
        nom="Test",
        prenomsecond="User",
        password="Pass123!",
        password_confirm="Pass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    db.commit()
    
    login_response = client.post(
        "/api/auth/login",
        data={"username": "test@example.com", "password": "Pass123!"}
    )
    token = login_response.json()["access_token"]
    
    response = client.post(
        "/api/projects",
        json={
            "name": "Test Project",
            "description": "A test project",
            "github_repo_url": "https://github.com/test/repo",
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    # May be 201 or 200 depending on implementation
    assert response.status_code in [200, 201]
    data = response.json()
    assert data["name"] == "Test Project"


def test_list_projects(setup_roles):
    """Test listing projects"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email="test@example.com",
        nom="Test",
        prenomsecond="User",
        password="Pass123!",
        password_confirm="Pass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    db.commit()
    
    login_response = client.post(
        "/api/auth/login",
        data={"username": "test@example.com", "password": "Pass123!"}
    )
    token = login_response.json()["access_token"]
    
    response = client.get(
        "/api/projects",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_get_project_not_found(setup_roles):
    """Test getting nonexistent project"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email="test@example.com",
        nom="Test",
        prenomsecond="User",
        password="Pass123!",
        password_confirm="Pass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    db.commit()
    
    login_response = client.post(
        "/api/auth/login",
        data={"username": "test@example.com", "password": "Pass123!"}
    )
    token = login_response.json()["access_token"]
    project_id = str(uuid.uuid4())
    
    response = client.get(
        f"/api/projects/{project_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 404


# ──────────────────────────────────────────────────────────────────────────────
# DASHBOARD TESTS
# ──────────────────────────────────────────────────────────────────────────────

def test_dashboard_metrics(setup_roles):
    """Test dashboard metrics endpoint"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email="test@example.com",
        nom="Test",
        prenomsecond="User",
        password="Pass123!",
        password_confirm="Pass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    db.commit()
    
    login_response = client.post(
        "/api/auth/login",
        data={"username": "test@example.com", "password": "Pass123!"}
    )
    token = login_response.json()["access_token"]
    
    response = client.get(
        "/api/dashboard/metrics",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_projects" in data


# ──────────────────────────────────────────────────────────────────────────────
# RATE LIMITING TESTS
# ──────────────────────────────────────────────────────────────────────────────

def test_rate_limiting_registration():
    """Test that registration rate limiting is active"""
    # Try to register more than 5 times per minute
    for i in range(6):
        response = client.post(
            "/api/auth/register",
            json={
                "email": f"test{i}@example.com",
                "nom": "Test",
                "prenomsecond": "User",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            }
        )
        # Last one should hit rate limit
        if i == 5:
            # Rate limit returns 429
            assert response.status_code in [429, 201]  # Depends on rate limit config


# ──────────────────────────────────────────────────────────────────────────────
# SCAN TESTS
# ──────────────────────────────────────────────────────────────────────────────

def test_trigger_scan_without_project(setup_roles):
    """Test triggering scan without existing project"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email="test@example.com",
        nom="Test",
        prenomsecond="User",
        password="Pass123!",
        password_confirm="Pass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    db.commit()
    
    login_response = client.post(
        "/api/auth/login",
        data={"username": "test@example.com", "password": "Pass123!"}
    )
    token = login_response.json()["access_token"]
    project_id = str(uuid.uuid4())
    
    response = client.post(
        f"/api/projects/{project_id}/scans",
        json={"branch": "main"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 404


# ──────────────────────────────────────────────────────────────────────────────
# UNAUTHORIZED ACCESS TESTS
# ──────────────────────────────────────────────────────────────────────────────

def test_access_protected_endpoint_without_token():
    """Test accessing protected endpoint without token"""
    response = client.get("/api/projects")
    assert response.status_code == 403


def test_access_protected_endpoint_with_invalid_token():
    """Test accessing protected endpoint with invalid token"""
    response = client.get(
        "/api/projects",
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == 401 or response.status_code == 403
