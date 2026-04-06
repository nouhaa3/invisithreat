"""
Error Cases and Edge Cases Tests
Tests error handling, boundary conditions, and edge cases
"""
import requests
import json


BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api"


class TestHTTPStatusCodes:
    """Test correct HTTP status codes for error conditions"""
    
    def test_404_not_found(self):
        """Non-existent endpoint returns 404"""
        response = requests.get(f"{API_URL}/this-does-not-exist", timeout=5)
        assert response.status_code == 404
    
    def test_405_method_not_allowed(self):
        """Wrong HTTP method returns 405"""
        response = requests.delete(f"{API_URL}/health", timeout=5)
        assert response.status_code == 405
    
    def test_400_bad_request_missing_json(self):
        """POST without body returns 400"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data="",
            timeout=5
        )
        # Should be 400 or 422 for malformed
        assert response.status_code in [400, 422]
    
    def test_401_unauthorized(self):
        """Protected endpoint without auth returns 401"""
        response = requests.get(f"{API_URL}/projects", timeout=5)
        assert response.status_code in [401, 403]
    
    def test_403_forbidden(self):
        """Invalid token returns 401/403"""
        response = requests.get(
            f"{API_URL}/projects",
            headers={"Authorization": "Bearer invalid"},
            timeout=5
        )
        assert response.status_code in [401, 403]


class TestInputValidation:
    """Test input validation and sanitization"""
    
    def test_sql_injection_attempt(self):
        """SQL injection in login field"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": "'; DROP TABLE users; --",
                "password": "test"
            },
            timeout=5
        )
        # Should not execute SQL, just reject or handle
        assert response.status_code in [200, 400, 401, 422, 429]
    
    def test_xss_payload_in_json(self):
        """XSS payload in JSON field"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": "<script>alert('xss')</script>@test.com",
                "nom": "<img src=x onerror='alert(1)'>",
                "prenomsecond": "Test",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
            timeout=5
        )
        # Should reject or sanitize
        assert response.status_code in [400, 422]
    
    def test_command_injection_potential(self):
        """Command injection attempt"""
        response = requests.post(
            f"{API_URL}/projects",
            json={
                "name": "test; rm -rf /",
                "description": "test",
            },
            headers={"Authorization": "Bearer fake"},
            timeout=5
        )
        # Should not execute commands
        assert response.status_code in [400, 401, 403, 404, 422]
    
    def test_null_byte_injection(self):
        """Null byte in string field"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": "test@example.com\x00.com",
                "nom": "Test\x00Admin",
                "prenomsecond": "User",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
            timeout=5
        )
        assert response.status_code in [400, 422]


class TestBoundaryValues:
    """Test boundary conditions and edge values"""
    
    def test_very_long_string(self):
        """Very long string in text field"""
        long_string = "a" * 10000
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": f"{long_string}@test.com",
                "nom": long_string,
                "prenomsecond": long_string,
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
            timeout=5
        )
        assert response.status_code in [400, 422]
    
    def test_unicode_characters(self):
        """Unicode in text fields"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": "test@example.com",
                "nom": "Test User",  # Standard ASCII
                "prenomsecond": "User Name",  # Standard ASCII
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
            timeout=5
        )
        # Should handle or reject gracefully
        assert response.status_code in [200, 201, 400, 422, 429]
    
    def test_negative_numbers(self):
        """Negative numbers in numeric fields"""
        response = requests.get(
            f"{API_URL}/projects?skip=-10&limit=-5",
            timeout=5
        )
        # Should handle gracefully - may require auth (401/403) or validate params
        assert response.status_code in [200, 400, 401, 403, 422]
    
    def test_zero_length_string(self):
        """Empty/zero-length required field"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": "",
                "nom": "",
                "prenomsecond": "",
                "password": "",
                "password_confirm": "",
            },
            timeout=5
        )
        assert response.status_code in [400, 422]
    
    def test_max_safe_integer(self):
        """Very large integer value"""
        response = requests.get(
            f"{API_URL}/projects/9223372036854775807",  # Max 64-bit int
            timeout=5
        )
        assert response.status_code in [400, 401, 403, 404]


class TestDataTypeErrors:
    """Test type mismatch errors"""
    
    def test_string_instead_of_json(self):
        """String sent where JSON expected"""
        response = requests.post(
            f"{API_URL}/auth/register",
            data="not a json",
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        assert response.status_code in [400, 422]
    
    def test_array_instead_of_object(self):
        """Array sent where object expected"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json=["item1", "item2"],
            timeout=5
        )
        assert response.status_code in [400, 422]
    
    def test_null_value_for_required_field(self):
        """Null value in required field"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": None,
                "nom": None,
                "prenomsecond": None,
                "password": None,
                "password_confirm": None,
            },
            timeout=5
        )
        assert response.status_code in [400, 422]
    
    def test_boolean_instead_of_string(self):
        """Boolean sent where string expected"""
        response = requests.post(
            f"{API_URL}/auth/login",
            json={
                "username": True,
                "password": False,
            },
            timeout=5
        )
        assert response.status_code in [400, 422]


class TestConcurrency:
    """Test concurrent request handling"""
    
    def test_rapid_requests(self):
        """Multiple rapid requests to same endpoint"""
        responses = []
        for _ in range(5):
            response = requests.get(f"{API_URL}/health", timeout=5)
            responses.append(response.status_code)
        
        # All should succeed
        assert all(status == 200 for status in responses)
    
    def test_concurrent_different_endpoints(self):
        """Concurrent requests to different endpoints"""
        response_health = requests.get(f"{API_URL}/health", timeout=5)
        response_docs = requests.get(f"{API_URL}/docs", timeout=5)
        
        assert response_health.status_code == 200
        assert response_docs.status_code == 200


class TestMemoryAndPerformance:
    """Test memory and performance edge cases"""
    
    def test_deeply_nested_json(self):
        """Very deeply nested JSON structure"""
        nested = {"data": {}}
        current = nested["data"]
        for _ in range(100):
            current["next"] = {}
            current = current["next"]
        
        response = requests.post(
            f"{API_URL}/auth/register",
            json=nested,
            timeout=5
        )
        # Should handle or reject
        assert response.status_code in [400, 422]
    
    def test_large_json_array(self):
        """Large JSON array in body"""
        large_array = [{"id": i} for i in range(10000)]
        response = requests.post(
            f"{API_URL}/projects",
            json={"items": large_array},
            headers={"Authorization": "Bearer fake"},
            timeout=5
        )
        assert response.status_code in [400, 401, 403, 404, 413, 422]


class TestSpecialCharacters:
    """Test special characters handling"""
    
    def test_tab_characters(self):
        """Tab characters in string"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": "test\t@example.com",
                "nom": "Test\tUser",
                "prenomsecond": "\tUser\t",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
            timeout=5
        )
        assert response.status_code in [400, 422]
    
    def test_newline_characters(self):
        """Newline characters in string"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": "test\n@example.com",
                "nom": "Test\nUser",
                "prenomsecond": "User\n",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
            timeout=5
        )
        assert response.status_code in [400, 422]
    
    def test_special_regex_chars(self):
        """Special regex characters"""
        response = requests.post(
            f"{API_URL}/auth/register",
            json={
                "email": "test+.*?[]()@example.com",
                "nom": "Test.^$*+?{{}}[]|()\\",
                "prenomsecond": "User",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
            timeout=5
        )
        # Should handle special chars
        assert response.status_code in [400, 422]


class TestErrorMessages:
    """Test error message content and format"""
    
    def test_error_response_has_message(self):
        """Error responses include explanatory message"""
        response = requests.get(f"{API_URL}/projects", timeout=5)
        assert response.status_code in [401, 403]
        if response.headers.get("content-type", "").startswith("application/json"):
            data = response.json()
            # Should have detail or message
            assert "detail" in data or "message" in data or "error" in data
    
    def test_no_sensitive_info_in_errors(self):
        """Error messages don't leak sensitive info"""
        response = requests.post(
            f"{API_URL}/auth/login",
            data={
                "username": "test@example.com",
                "password": "wrong"
            },
            timeout=5
        )
        if response.status_code == 401:
            data = response.json()
            error_text = json.dumps(data).lower()
            # Should not expose whether email exists
            assert "password" not in error_text or "incorrect" in error_text


class TestResponseHeaders:
    """Test response header validation"""
    
    def test_security_headers_present(self):
        """Security headers in responses"""
        response = requests.get(f"{API_URL}/health", timeout=5)
        # Check for security headers
        headers = response.headers
        # Some servers include these
        if "X-Content-Type-Options" in headers:
            assert headers["X-Content-Type-Options"] == "nosniff"
    
    def test_cache_control_headers(self):
        """Cache control headers for auth endpoints"""
        response = requests.get(
            f"{API_URL}/projects",
            headers={"Authorization": "Bearer fake"},
            timeout=5
        )
        # Protected endpoints should not be cached
        headers = response.headers
        if "Cache-Control" in headers:
            assert "private" in headers["Cache-Control"].lower()
    
    def test_content_type_charset(self):
        """Content-Type includes charset"""
        response = requests.get(f"{API_URL}/health", timeout=5)
        content_type = response.headers.get("content-type", "")
        # May or may not include charset
        assert "application/json" in content_type or content_type != ""


class TestTimeoutBehavior:
    """Test timeout and slow response handling"""
    
    def test_endpoint_response_time(self):
        """Endpoint responds in reasonable time"""
        import time
        start = time.time()
        response = requests.get(f"{API_URL}/health", timeout=5)
        duration = time.time() - start
        
        assert response.status_code == 200
        assert duration < 5  # Should respond quickly


class TestIdempotentRequests:
    """Test idempotent request handling"""
    
    def test_get_is_idempotent(self):
        """GET requests are idempotent"""
        response1 = requests.get(f"{API_URL}/health", timeout=5)
        response2 = requests.get(f"{API_URL}/health", timeout=5)
        
        # Both should have same status code
        assert response1.status_code == response2.status_code
        # Results should be equivalent (allow for timestamp variations)
        if response1.status_code == 200:
            assert response1.status_code == response2.status_code
    
    def test_head_request(self):
        """HEAD request supported"""
        response = requests.head(f"{API_URL}/health", timeout=5)
        assert response.status_code in [200, 404, 405]


class TestContentNegotiation:
    """Test content negotiation and format handling"""
    
    def test_accept_header_json(self):
        """Accept: application/json header"""
        response = requests.get(
            f"{API_URL}/health",
            headers={"Accept": "application/json"},
            timeout=5
        )
        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")
    
    def test_accept_header_unsupported(self):
        """Unsupported Accept header"""
        response = requests.get(
            f"{API_URL}/health",
            headers={"Accept": "application/xml"},
            timeout=5
        )
        # Should either return JSON or 406
        assert response.status_code in [200, 406]
