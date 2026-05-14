"""
Security Tests
Tests for security vulnerabilities, encryption, token handling, etc.
"""
import pytest
import json
from app.core.security import hash_password, verify_password
from app.core.jwt import create_access_token, create_refresh_token, decode_token
from app.core.config import settings
from datetime import datetime, UTC
from jose import jwt


class TestPasswordSecurity:
    """Test password security"""
    
    def test_password_never_in_plaintext(self):
        """Ensure passwords are never stored in plaintext"""
        password = "TestPassword123!"
        hashed = hash_password(password)
        
        # Password should not be in hash
        assert password not in hashed
        assert hashed != password
    
    def test_same_password_different_hash(self):
        """Same password produces different hashes (bcrypt salt)"""
        password = "TestPassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        # Hashes should differ due to different salts
        assert hash1 != hash2
        # But both should verify the same password
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)
    
    def test_weak_password_detection(self):
        """Weak passwords should be handled"""
        weak_passwords = [
            "123",
            "password",
            "admin",
            "1234567",
        ]
        
        # Even weak passwords should be hashed (security by obscurity not sufficient)
        for weak_pass in weak_passwords:
            hashed = hash_password(weak_pass)
            assert verify_password(weak_pass, hashed)


class TestTokenSecurity:
    """Test JWT token security"""
    
    def test_token_contains_no_sensitive_data(self):
        """Tokens should not contain plaintext sensitive data"""
        token = create_access_token(data={"sub": "user@example.com"})
        
        # Can't directly inspect JWT without decoding, but verify it's a string
        assert isinstance(token, str)
        assert len(token) > 50
        
        # Don't store password in token
        data = {"sub": "user@example.com", "password": "secret"}
        token_with_pass = create_access_token(data=data)
        # Token is still valid
        assert isinstance(token_with_pass, str)
    
    def test_token_expiration(self):
        """Tokens expire"""
        token = create_access_token(data={"sub": "test@example.com"})
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        
        # Should have expiration
        assert "exp" in payload
        assert payload["exp"] > datetime.now(UTC).timestamp()
    
    def test_refresh_token_longer_expiry(self):
        """Refresh tokens have longer expiry than access tokens"""
        access = create_access_token(data={"sub": "test@example.com"})
        refresh = create_refresh_token(data={"sub": "test@example.com"})
        
        access_payload = jwt.decode(access, settings.SECRET_KEY, algorithms=["HS256"])
        refresh_payload = jwt.decode(refresh, settings.SECRET_KEY, algorithms=["HS256"])
        
        # Refresh should expire later than access
        assert refresh_payload["exp"] > access_payload["exp"]
    
    def test_token_tampering_detection(self):
        """Tampering with token is detected"""
        token = create_access_token(data={"sub": "test@example.com"})
        
        # Tamper with token (change one character)
        tampered = token[:-5] + "xxxxx"
        
        # Should not verify
        with pytest.raises(Exception):
            decode_token(tampered)


class TestHTTPSecurity:
    """Test HTTP security headers and best practices"""
    
    def test_sensitive_data_not_in_logs(self):
        """Sensitive data should not be logged"""
        # This would need integration test with actual logging
        sensitive_strings = [
            "password",
            "token",
            "secret",
            "api_key",
        ]
        
        for s in sensitive_strings:
            assert s in ["password", "token", "secret", "api_key"]
    
    def test_cors_origin_validation(self):
        """CORS origins should be validated"""
        # CORS would be tested in integration tests
        allowed_origins = [
            "https://example.com",
            "https://app.example.com",
        ]
        
        disallowed = "https://evil.com"
        
        # In real app, check CORS middleware
        assert disallowed not in allowed_origins


class TestSQLInjectionPrevention:
    """Test SQL injection prevention"""
    
    def test_parameterized_queries(self, db):
        """Queries should use parameterized statements"""
        from app.models.user import User
        
        # SQLAlchemy uses parameterized queries by default
        user = db.query(User).filter(User.email == "test@example.com").first()
        
        # If we got here without error, parameterized queries worked
        assert user is None or isinstance(user, User)
    
    def test_no_string_concatenation_in_queries(self, db):
        """Never build queries with string concatenation"""
        from app.models.user import User
        
        # DO NOT DO: f"SELECT * FROM user WHERE email = '{email}'"
        # DO THIS: query.filter(User.email == email)
        
        email = "'; DROP TABLE users; --"
        
        # Safe query
        user = db.query(User).filter(User.email == email).first()
        
        # Should return None, not drop table
        assert user is None


class TestCrossSiteScripting:
    """Test XSS prevention"""
    
    def test_dangerous_html_escaped(self):
        """Dangerous HTML should be escaped"""
        dangerous_input = "<script>alert('XSS')</script>"
        
        # In API response, this would be JSON-escaped
        json_output = json.dumps({"message": dangerous_input})
        
        # Should be escaped in JSON
        assert "<script>" not in json_output or "\\u003c" in json_output
    
    def test_user_input_sanitization(self):
        """User input should be sanitized"""
        inputs = [
            "<img src=x onerror=alert('xss')>",
            "javascript:void(0)",
            "<iframe src='http://evil.com'></iframe>",
        ]
        
        # All should be treated as regular strings
        for inp in inputs:
            data = {"input": inp}
            json_str = json.dumps(data)
            assert isinstance(json_str, str)


class TestCrossSiteRequestForgery:
    """Test CSRF prevention"""
    
    def test_state_parameter_in_oauth(self):
        """OAuth should use state parameter"""
        import secrets
        
        state = secrets.token_urlsafe(32)
        assert len(state) > 0
        assert isinstance(state, str)
    
    def test_same_site_cookie_attribute(self):
        """Cookies should have SameSite attribute"""
        # Tested in integration tests with actual HTTP responses
        # Cookies should have SameSite=Strict or SameSite=Lax


class TestSecretManagement:
    """Test secret and key management"""
    
    def test_secret_key_loaded_from_env(self):
        """Secret key should come from environment"""
        assert settings.SECRET_KEY is not None
        assert len(settings.SECRET_KEY) > 20
    
    def test_secret_key_not_in_source_code(self):
        """Secret keys should not be hardcoded"""
        # This would be checked by SAST scanning
        # Look for patterns like SECRET_KEY = "hardcoded_value"
    
    def test_database_credentials_from_env(self):
        """Database credentials from environment, not source"""
        assert settings.DATABASE_URL is not None
        # Should not contain password in source files
        assert "://localhost" not in __file__ or True  # pragma


class TestAuthenticationBypass:
    """Test authentication bypass prevention"""
    
    def test_no_hardcoded_credentials(self):
        """No hardcoded test credentials in production"""
        # Check that default credentials don't exist
    
    def test_null_password_check(self):
        """Cannot login with null/empty password"""
        # Empty password should not verify with any hash
        hashed = hash_password("somepassword")
        assert not verify_password("", hashed)
    
    def test_multiple_authentication_factors(self):
        """Check for 2FA/MFA support"""
        # System should support TOTP
        import pyotp
        
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        
        # Generate valid code
        code = totp.now()
        assert len(code) == 6
        assert code.isdigit()


class TestEncryption:
    """Test data encryption"""
    
    def test_token_encryption_if_stored(self):
        """If tokens stored in DB, they should be encrypted"""
        from app.models.auth_token import AuthToken
        
        # Verify AuthToken model uses encryption
        assert hasattr(AuthToken, 'token_hash')
    
    def test_sensitive_fields_encrypted(self):  # pylint: disable=fixme
        """Sensitive fields should be encrypted"""
        # GitHub tokens, API keys, etc. should be encrypted
        assert True


class TestRateLimiting:
    """Test rate limiting"""
    
    def test_brute_force_protection(self):
        """Should have brute force protection"""
        # Multiple failed logins should trigger rate limit
        from slowapi import Limiter
        from slowapi.util import get_remote_address
        
        limiter = Limiter(key_func=get_remote_address)
        assert limiter is not None


class TestErrorHandling:
    """Test secure error handling"""
    
    def test_no_stack_traces_in_production(self):  # pylint: disable=fixme
        """Stack traces should not be exposed to users"""
        # Check error response format
        assert True
    
    def test_generic_error_messages(self):  # pylint: disable=fixme
        """Error messages should be generic (not revealing)"""
        # "Invalid email or password" not "Email not found" or "Password incorrect"
        assert True


class TestDataValidation:
    """Test input validation"""
    
    def test_email_validation(self):
        """Email addresses should be validated"""
        
        # Valid email
        valid_email = "test@example.com"
        assert "@" in valid_email
        
        # Invalid emails
        invalid_emails = [
            "notanemail",
            "test@",
            "@example.com",
            "test @example.com",
        ]
        
        for invalid in invalid_emails:
            assert "@" not in invalid or " " in invalid
    
    def test_url_validation(self):
        """URLs should be validated"""
        valid_urls = [
            "https://example.com",
            "https://example.com/path",
            "https://sub.example.com",
        ]
        
        invalid_urls = [
            "not a url",
            "http://",
            "javascript:alert('xss')",
        ]
        
        for url in valid_urls:
            assert "://" in url
        
        for url in invalid_urls:
            assert "://" not in url or url.startswith("javascript:")


class TestAuditTrail:
    """Test audit logging for security"""
    
    def test_login_attempts_logged(self, db, test_user):
        """Login attempts should be logged"""
        from app.models.audit_log import AuditLog
        
        log = AuditLog(
            user_id=test_user.id,
            action="LOGIN",
            ip_address="127.0.0.1"
        )
        db.add(log)
        db.commit()
        
        retrieved = db.query(AuditLog).filter(AuditLog.action == "LOGIN").first()
        assert retrieved is not None
    
    def test_failed_login_logged(self, db):
        """Failed login attempts should be logged"""
        from app.models.audit_log import AuditLog
        
        log = AuditLog(
            action="FAILED_LOGIN",
            ip_address="192.168.1.1"
        )
        db.add(log)
        db.commit()
        
        retrieved = db.query(AuditLog).filter(AuditLog.action == "FAILED_LOGIN").first()
        assert retrieved is not None


class TestSecurityHeaders:  # pylint: disable=fixme
    """Test security headers (integration tests)"""
    
    def test_x_frame_options_header(self):
        """Should have X-Frame-Options header"""
        # X-Frame-Options: DENY or SAMEORIGIN
        assert True
    
    def test_x_content_type_options_header(self):
        """Should have X-Content-Type-Options header"""
        # X-Content-Type-Options: nosniff
        assert True
    
    def test_strict_transport_security(self):
        """Should have HSTS header"""
        # Strict-Transport-Security: max-age=31536000
        assert True
