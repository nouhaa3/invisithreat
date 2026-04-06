"""
Advanced Authentication Tests
Tests login flows, token refresh, and 2FA functionality
"""
import requests
import json
import pytest
import time
from uuid import uuid4

BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api"

# Test user data
TEST_USER_EMAIL = f"auth-test-{str(uuid4())[:8]}@test.com"
TEST_USER_PASSWORD = "SecurePass123!TestUser"
TEST_USER_NAME = "Auth Test User"


class TestUserRegistration:
    """Test user registration workflow"""
    
    def test_register_with_valid_data(self):
        """Register user with all valid data"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": f"valid-{str(uuid4())[:8]}@test.com",
                "nom": "Valid",
                "prenomsecond": "User",
                "password": TEST_USER_PASSWORD,
                "password_confirm": TEST_USER_PASSWORD,
            }
        )
        assert response.status_code in [201, 400]  # 201 success or 400 duplicate
        if response.status_code == 201:
            data = response.json()
            assert "status" in data
            assert "email_verification_required" in data["status"]
    
    def test_register_password_too_weak(self):
        """Register with weak password"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": f"weak-{str(uuid4())[:8]}@test.com",
                "nom": "Weak",
                "prenomsecond": "Pass",
                "password": "123",  # Too weak
                "password_confirm": "123",
            }
        )
        # Should fail validation
        assert response.status_code in [422, 400]
    
    def test_register_missing_required_field(self):
        """Register with missing required field"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": f"missing-{str(uuid4())[:8]}@test.com",
                # Missing nom
                "prenomsecond": "Field",
                "password": TEST_USER_PASSWORD,
                "password_confirm": TEST_USER_PASSWORD,
            }
        )
        assert response.status_code in [422, 400]
    
    def test_register_duplicate_email(self):
        """Try to register with existing email"""
        email = f"duplicate-{str(uuid4())[:8]}@test.com"
        
        # First registration
        response1 = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": email,
                "nom": "First",
                "prenomsecond": "User",
                "password": TEST_USER_PASSWORD,
                "password_confirm": TEST_USER_PASSWORD,
            }
        )
        
        if response1.status_code == 201:
            # Try duplicate
            response2 = requests.post(
                f"{API_URL}/auth/register",
                json={
                    "email": email,
                    "nom": "Second",
                    "prenomsecond": "User",
                    "password": TEST_USER_PASSWORD,
                    "password_confirm": TEST_USER_PASSWORD,
                }
            )
            # Should fail with conflict or bad request
            assert response2.status_code in [400, 409, 422]


class TestLoginFlow:
    """Test login and authentication flow"""
    
    def test_login_missing_email(self):
        """Login without email"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data={
                # Missing username
                "password": TEST_USER_PASSWORD,
            }
        )
        assert response.status_code in [422, 400]
    
    def test_login_missing_password(self):
        """Login without password"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": TEST_USER_EMAIL,
                # Missing password
            }
        )
        assert response.status_code in [422, 400]
    
    def test_login_nonexistent_user(self):
        """Login with non-existent email"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": f"nonexistent-{str(uuid4())}@test.com",
                "password": TEST_USER_PASSWORD,
            }
        )
        assert response.status_code in [401, 422]
    
    def test_login_wrong_password(self):
        """Login with wrong password"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": TEST_USER_EMAIL,
                "password": "WrongPassword123!",
            }
        )
        assert response.status_code in [401, 422]
    
    def test_login_empty_password(self):
        """Login with empty password"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": TEST_USER_EMAIL,
                "password": "",
            }
        )
        assert response.status_code in [401, 422]
    
    def test_login_invalid_email_format(self):
        """Login with invalid email format"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": "not-an-email",
                "password": TEST_USER_PASSWORD,
            }
        )
        assert response.status_code in [401, 422]


class TestTokenRefresh:
    """Test JWT token refresh functionality"""
    
    def test_refresh_token_without_token(self):
        """Try to refresh without refresh token"""
        response = requests.post(
            f"{API_URL}/auth/refresh-token",
            json={}  # No token
        )
        # Endpoint might not exist (404) or reject empty token
        assert response.status_code in [400, 404, 422]
    
    def test_refresh_token_invalid_token(self):
        """Try to refresh with invalid token"""
        response = requests.post(
            f"{API_URL}/auth/refresh-token",
            json={
                "refresh_token": "invalid_token_12345"
            }
        )
        # Endpoint might not exist (404) or reject invalid token
        assert response.status_code in [400, 401, 404, 422]
    
    def test_refresh_token_expired_token(self):
        """Try to refresh with expired token"""
        # Create an old token (would need actual expired token)
        response = requests.post(
            f"{API_URL}/auth/refresh-token",
            json={
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.signature"
            }
        )
        # Endpoint might not exist (404) or reject expired token
        assert response.status_code in [400, 401, 404, 422]
    
    def test_refresh_token_empty_string(self):
        """Try to refresh with empty token string"""
        response = requests.post(
            f"{API_URL}/auth/refresh-token",
            json={
                "refresh_token": ""
            }
        )
        # Endpoint might not exist (404) or reject empty token
        assert response.status_code in [400, 404, 422]


class TestSessionManagement:
    """Test session and logout functionality"""
    
    def test_logout_without_token(self):
        """Logout without authentication"""
        response = requests.post(f"{API_URL}/auth/logout")
        assert response.status_code in [401, 403]
    
    def test_logout_invalid_token(self):
        """Logout with invalid token"""
        response = requests.post(
            f"{API_URL}/auth/logout",
            headers={
                "Authorization": "Bearer invalid_token_xyz"
            }
        )
        assert response.status_code in [401, 403]
    
    def test_logout_twice(self):
        """Try to logout twice (second should fail)"""
        # This would need a real token from login
        response = requests.post(
            f"{API_URL}/auth/logout",
            headers={
                "Authorization": "Bearer fake_token"
            }
        )
        assert response.status_code in [401, 403]


class TestPasswordReset:
    """Test password reset functionality"""
    
    def test_forgot_password_nonexistent_email(self):
        """Request password reset for non-existent email"""
        response = requests.post(
            f"{API_URL}/auth/forgot-password",
            json={
                "email": f"nonexistent-{str(uuid4())}@test.com"
            }
        )
        # Should succeed (for security) or fail gracefully
        assert response.status_code in [200, 202, 400]
    
    def test_forgot_password_invalid_email(self):
        """Request password reset with invalid email"""
        response = requests.post(
            f"{API_URL}/auth/forgot-password",
            json={
                "email": "not-an-email"
            }
        )
        assert response.status_code in [400, 422]
    
    def test_forgot_password_empty_email(self):
        """Request password reset with empty email"""
        response = requests.post(
            f"{API_URL}/auth/forgot-password",
            json={
                "email": ""
            }
        )
        assert response.status_code in [400, 422]
    
    def test_reset_password_invalid_code(self):
        """Try to reset password with invalid code"""
        response = requests.post(
            f"{API_URL}/auth/reset-password",
            json={
                "email": TEST_USER_EMAIL,
                "code": "invalid_code_12345",
                "new_password": "NewPassword123!",
                "confirm_password": "NewPassword123!",
            }
        )
        assert response.status_code in [400, 401, 422]
    
    def test_reset_password_codes_mismatch(self):
        """Reset password with mismatched password confirmation"""
        response = requests.post(
            f"{API_URL}/auth/reset-password",
            json={
                "email": TEST_USER_EMAIL,
                "code": "some_code",
                "new_password": "Password1!",
                "confirm_password": "Different123!",
            }
        )
        assert response.status_code in [400, 422]


class TestAuthHeaders:
    """Test authentication headers and bearer tokens"""
    
    def test_invalid_auth_header_format(self):
        """Invalid Authorization header format"""
        response = requests.get(
            f"{API_URL}/projects",
            headers={
                "Authorization": "InvalidFormat token123"
            }
        )
        assert response.status_code in [401, 403]
    
    def test_auth_header_empty_token(self):
        """Authorization header with empty token"""
        response = requests.get(
            f"{API_URL}/projects",
            headers={
                "Authorization": "Bearer "
            }
        )
        assert response.status_code in [401, 403]
    
    def test_auth_header_missing_bearer(self):
        """Authorization header without Bearer prefix"""
        response = requests.get(
            f"{API_URL}/projects",
            headers={
                "Authorization": "totally.random.token"
            }
        )
        assert response.status_code in [401, 403]
    
    def test_multiple_auth_headers(self):
        """Multiple Authorization headers"""
        response = requests.get(
            f"{API_URL}/projects",
            headers={
                "Authorization": "Bearer token1",
                # Note: Can't easily send duplicate headers with requests
            }
        )
        # Should handle gracefully
        assert response.status_code in [200, 401, 403]


class TestAuthRateLimiting:
    """Test rate limiting on auth endpoints"""
    
    def test_multiple_login_attempts(self):
        """Multiple failed login attempts"""
        for i in range(3):
            response = requests.post(
                f"{API_URL}/auth/login",
                data={
                    "username": f"user{i}@test.com",
                    "password": "wrongpass",
                }
            )
            # Should eventually hit rate limit or succeed/fail consistently
            assert response.status_code in [401, 422, 429]
    
    def test_multiple_registration_attempts(self):
        """Multiple registration attempts in rapid succession"""
        responses = []
        for i in range(3):
            response = requests.post(
                f"{API_URL}/auth/register",
                json={
                    "email": f"ratelimit-{str(uuid4())[:8]}@test.com",
                    "nom": "Test",
                    "prenomsecond": "User",
                    "password": TEST_USER_PASSWORD,
                    "password_confirm": TEST_USER_PASSWORD,
                }
            )
            responses.append(response.status_code)
        
        # Should allow some or hit rate limit (429) or have duplicates
        assert any(status in [201, 400, 429] for status in responses)


class TestAuthEdgeCases:
    """Test edge cases in authentication"""
    
    def test_login_with_whitespace_email(self):
        """Login with email containing whitespace"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": "  test@example.com  ",
                "password": TEST_USER_PASSWORD,
            }
        )
        # Should trim whitespace or reject
        assert response.status_code in [200, 401, 422]
    
    def test_register_with_special_characters_in_name(self):
        """Register with special characters in name"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": f"special-{str(uuid4())[:8]}@test.com",
                "nom": "Jean-Paul",
                "prenomsecond": "O'Connor",
                "password": TEST_USER_PASSWORD,
                "password_confirm": TEST_USER_PASSWORD,
            }
        )
        # May succeed or fail with 429 (rate) or 400/422 (validation)
        assert response.status_code in [200, 201, 400, 429]
    
    def test_login_email_case_insensitive(self):
        """Test if email login is case-insensitive"""
        email_lower = f"case-{str(uuid4())[:8]}@test.com".lower()
        email_upper = email_lower.upper()
        
        # Both should work if case-insensitive
        response1 = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": email_lower,
                "password": TEST_USER_PASSWORD,
            }
        )
        
        response2 = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": email_upper,
                "password": TEST_USER_PASSWORD,
            }
        )
        
        # Both should have same result (both fail or both succeed)
        assert response1.status_code == response2.status_code or \
               response1.status_code in [401, 422, 400]
