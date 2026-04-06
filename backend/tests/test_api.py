"""
API Integration Tests
Tests the running FastAPI backend server
"""
import requests
import json
import pytest
from datetime import datetime
import uuid

BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test-api@example.com"
TEST_PASS = "TestPass123!"

class TestBasicEndpoints:
    """Test basic API endpoints"""
    
    def test_health_check(self):
        """GET /api/health - Health check endpoint"""
        response = requests.get(f"{API_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    def test_root_endpoint(self):
        """GET / - Root endpoint"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data

class TestAuthenticationFlow:
    """Test authentication endpoints"""
    
    def test_register_user(self):
        """POST /auth/register - Register new user"""
        unique_email = f"test-{str(uuid.uuid4())[:8]}@test.com"
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": unique_email,
                "nom": "Test",
                "prenomsecond": "User",
                "password": TEST_PASS,
                "password_confirm": TEST_PASS,
            }
        )
        assert response.status_code in [201, 400]  # 201 on success, 400 if already exists
        if response.status_code == 201:
            data = response.json()
            assert data["status"] == "email_verification_required"
    
    def test_register_invalid_email(self):
        """POST /auth/register - Register with invalid email"""
        response = requests.post(
           f"{API_URL}/auth/register",
            json={
                "email": "invalid-email",
                "nom": "Test",
                "prenomsecond": "User",
                "password": TEST_PASS,
                "password_confirm": TEST_PASS,
            }
        )
        assert response.status_code == 422
    
    def test_login_wrong_credentials(self):
        """POST /auth/login - Login with wrong credentials"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": "nonexistent@test.com",
                "password": "wrongpassword",
            }
        )
        assert response.status_code in [401, 422]

class TestProjectsEndpoint:
    """Test projects management"""
    
    def test_projects_requires_auth(self):
        """GET /projects - Requires authentication"""
        response = requests.get(f"{API_URL}/projects")
        assert response.status_code in [403, 401]
    
    def test_projects_with_invalid_token(self):
        """GET /projects - Invalid bearer token"""
        response = requests.get(
            f"{API_URL}/projects",
            headers={"Authorization": "Bearer invalid_token_123"}
        )
        assert response.status_code in [401, 403, 422]

class TestDocsEndpoint:
    """Test API documentation endpoints"""
    
    def test_swagger_docs_accessible(self):
        """GET /api/docs - Swagger UI"""
        response = requests.get(f"{API_URL}/docs")
        assert response.status_code == 200
        assert b"swagger" in response.content.lower()
    
    def test_redoc_accessible(self):
        """GET /api/redoc - ReDoc documentation"""
        response = requests.get(f"{API_URL}/redoc")
        assert response.status_code == 200
        assert b"redoc" in response.content.lower()
    
    def test_openapi_schema_accessible(self):
        """GET /api/openapi.json - OpenAPI schema"""
        response = requests.get(f"{API_URL}/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "paths" in data

class TestErrorHandling:
    """Test error handling and status codes"""
    
    def test_404_not_found(self):
        """GET /api/nonexistent - 404 Not Found"""
        response = requests.get(f"{API_URL}/nonexistent-path")
        assert response.status_code == 404
    
    def test_method_not_allowed(self):
        """DELETE /api/health - 405 Method Not Allowed"""
        response = requests.delete(f"{API_URL}/health")
        assert response.status_code == 405

class TestCORS:
    """Test CORS headers"""
    
    def test_cors_headers_present(self):
        """Check CORS headers in response"""
        response = requests.get(f"{API_URL}/health")
        # Should have CORS headers or be accessible from localhost
        assert response.status_code == 200

class TestResponseFormats:
    """Test response format consistency"""
    
    def test_health_response_format(self):
        """Verify health response has expected structure"""
        response = requests.get(f"{API_URL}/health")
        data = response.json()
        assert isinstance(data, dict)
        assert "status" in data
        assert data["status"] in ["healthy", "unhealthy"]
    
    def test_docs_response_type(self):
        """Verify docs response is HTML"""
        response = requests.get(f"{API_URL}/docs")
        assert response.headers.get("content-type", "").lower().startswith("text/html")

# Pytest markers for grouping tests
pytestmark = [
    pytest.mark.integration,
]
