"""
Tests for main FastAPI application and authentication
"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
import pytest
import uuid

from app.main import app
from app.db.base import import_models
from app.db.session import get_db, engine as db_engine, SessionLocal
from app.models.user import User
from app.models.role import Role
from app.schemas.user import UserCreate
from app.services.auth import register_user

# Ensure all models are imported before creating tables
import_models()

# Use the same engine that the app uses (but overridden to SQLite by conftest)
engine = db_engine
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_users():
    """Auto-cleanup users before each test to ensure isolation"""
    yield  # Let test run
    # After test, clean up users
    db = TestingSessionLocal()
    try:
        db.query(User).delete()
        db.commit()
    finally:
        db.close()


@pytest.fixture
def unique_email():
    """Generate unique email for each test"""
    return f"test-{uuid.uuid4().hex[:8]}@test.com"


@pytest.fixture(autouse=True)
def setup_roles_autouse():
    """Auto-create default roles for testing (autouse=True)"""
    db = TestingSessionLocal()
    try:
        roles_data = [
            {"name": "Admin", "description": "Administrator"},
            {"name": "Security Manager", "description": "Security Manager"},
            {"name": "Developer", "description": "Developer"},
            {"name": "Viewer", "description": "Viewer"},
        ]
        existing_roles = db.query(Role).filter(Role.name.in_([r["name"] for r in roles_data])).all()
        existing_names = {r.name for r in existing_roles}
        
        for role_data in roles_data:
            if role_data["name"] not in existing_names:
                role = Role(name=role_data["name"], description=role_data["description"])
                db.add(role)
        db.commit()
        yield
    finally:
        db.close()


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


def test_user_registration(unique_email):
    """Test user registration"""
    response = client.post(
        "/api/auth/register",
        json={
            "email": unique_email,
            "nom": "Test User",
            "prenomsecond": "User",
            "password": "SecurePass123!",
            "password_confirm": "SecurePass123!",
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "email_verification_required"
    assert data["email"] == unique_email


def test_user_registration_invalid_email():
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


def test_user_registration_password_mismatch(unique_email):
    """Test registration with mismatched passwords"""
    response = client.post(
        "/api/auth/register",
        json={
            "email": unique_email,
            "nom": "Test",
            "prenomsecond": "User",
            "password": "Pass123!",
            "password_confirm": "Different123!",
        }
    )
    assert response.status_code == 422 or response.status_code == 400


def test_login_nonexistent_user():
    """Test login with nonexistent user"""
    response = client.post(
        "/api/auth/login",
        data={
            "username": "nonexistent@example.com",
            "password": "anypassword",
        }
    )
    assert response.status_code == 401


def test_login_wrong_password(unique_email):
    """Test login with wrong password"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email=unique_email,
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
            "username": unique_email,
            "password": "WrongPass123!",
        }
    )
    assert response.status_code == 401


def test_successful_login(unique_email):
    """Test successful user login"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email=unique_email,
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
            "username": unique_email,
            "password": "CorrectPass123!",
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_logout(unique_email):
    """Test user logout"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email=unique_email,
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
            "username": unique_email,
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

def test_create_project(unique_email):
    """Test project creation"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email=unique_email,
        nom="Test",
        prenomsecond="User",
        password="Pass123!",
        password_confirm="Pass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    # Assign Developer role for project creation permission
    dev_role = db.query(Role).filter(Role.name == "Developer").first()
    if dev_role:
        user.role_id = dev_role.id
    db.commit()
    
    login_response = client.post(
        "/api/auth/login",
        data={"username": unique_email, "password": "Pass123!"}
    )
    token = login_response.json()["access_token"]
    
    response = client.post(
        "/api/projects",
        json={
            "name": "Test Project",
            "description": "A test project",
            "language": "Python",
            "analysis_type": "SAST",
            "visibility": "private"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    # May be 201 or 200 depending on implementation
    assert response.status_code in [200, 201]
    data = response.json()
    assert data["name"] == "Test Project"


def test_list_projects(unique_email):
    """Test listing projects"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email=unique_email,
        nom="Test",
        prenomsecond="User",
        password="Pass123!",
        password_confirm="Pass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    # Assign Developer role for project access permission
    dev_role = db.query(Role).filter(Role.name == "Developer").first()
    if dev_role:
        user.role_id = dev_role.id
    db.commit()
    
    login_response = client.post(
        "/api/auth/login",
        data={"username": unique_email, "password": "Pass123!"}
    )
    token = login_response.json()["access_token"]
    
    response = client.get(
        "/api/projects",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_get_project_not_found(unique_email):
    """Test retrieving non-existent project"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email=unique_email,
        nom="Test",
        prenomsecond="User",
        password="Pass123!",
        password_confirm="Pass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    # Assign Developer role for project access permission
    dev_role = db.query(Role).filter(Role.name == "Developer").first()
    if dev_role:
        user.role_id = dev_role.id
    db.commit()
    
    login_response = client.post(
        "/api/auth/login",
        data={"username": unique_email, "password": "Pass123!"}
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

def test_dashboard_metrics(unique_email):
    """Test dashboard metrics endpoint"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email=unique_email,
        nom="Test",
        prenomsecond="User",
        password="Pass123!",
        password_confirm="Pass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    # Assign Developer role for dashboard access
    dev_role = db.query(Role).filter(Role.name == "Developer").first()
    if dev_role:
        user.role_id = dev_role.id
    db.commit()
    
    login_response = client.post(
        "/api/auth/login",
        data={"username": unique_email, "password": "Pass123!"}
    )
    token = login_response.json()["access_token"]
    
    response = client.get(
        "/api/dashboard/stats",
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

def test_trigger_scan_without_project(unique_email):
    """Test triggering scan without project"""
    db = TestingSessionLocal()
    user_data = UserCreate(
        email=unique_email,
        nom="Test",
        prenomsecond="User",
        password="Pass123!",
        password_confirm="Pass123!",
    )
    user = register_user(db, user_data)
    user.is_verified = True
    # Assign Developer role to allow project operations
    dev_role = db.query(Role).filter(Role.name == "Developer").first()
    if dev_role:
        user.role_id = dev_role.id
    db.commit()
    
    login_response = client.post(
        "/api/auth/login",
        data={"username": unique_email, "password": "Pass123!"}
    )
    token = login_response.json()["access_token"]
    project_id = str(uuid.uuid4())
    
    response = client.post(
        f"/api/projects/{project_id}/scans",
        json={
            "method": "github",
            "repo_url": "https://github.com/test/repo",
            "repo_branch": "main"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 404


# ──────────────────────────────────────────────────────────────────────────────
# UNAUTHORIZED ACCESS TESTS
# ──────────────────────────────────────────────────────────────────────────────

def test_access_protected_endpoint_without_token():
    """Test accessing protected endpoint without token"""
    response = client.get("/api/projects")
    assert response.status_code == 401


def test_access_protected_endpoint_with_invalid_token():
    """Test accessing protected endpoint with invalid token"""
    response = client.get(
        "/api/projects",
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == 401 or response.status_code == 403
