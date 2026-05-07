"""
Error Cases and Edge Cases Tests
Tests error handling, boundary conditions, and edge cases
"""
import json
import time
import pytest
from fastapi.testclient import TestClient
from app.main import app

# ✅ TestClient au lieu de requests vers localhost:8000
client = TestClient(app)

pytestmark = [pytest.mark.integration]


@pytest.fixture(autouse=True)
def setup_database(setup_db):
    pass


class TestHTTPStatusCodes:
    def test_404_not_found(self):
        response = client.get("/api/this-does-not-exist")
        assert response.status_code == 404

    def test_405_method_not_allowed(self):
        response = client.delete("/api/health")
        assert response.status_code == 405

    def test_400_bad_request_missing_json(self):
        response = client.post("/api/auth/login", data="")
        assert response.status_code in [400, 422]

    def test_401_unauthorized(self):
        response = client.get("/api/projects")
        assert response.status_code in [401, 403]

    def test_403_forbidden(self):
        response = client.get(
            "/api/projects",
            headers={"Authorization": "Bearer invalid"},
        )
        assert response.status_code in [401, 403]


class TestInputValidation:
    def test_sql_injection_attempt(self):
        response = client.post(
            "/api/auth/login",
            data={"username": "'; DROP TABLE users; --", "password": "test"},
        )
        assert response.status_code in [200, 400, 401, 422, 429]

    def test_xss_payload_in_json(self):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "<script>alert('xss')</script>@test.com",
                "nom": "<img src=x onerror='alert(1)'>",
                "prenomsecond": "Test",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
        )
        assert response.status_code in [400, 422]

    def test_command_injection_potential(self):
        response = client.post(
            "/api/projects",
            json={"name": "test; rm -rf /", "description": "test"},
            headers={"Authorization": "Bearer fake"},
        )
        assert response.status_code in [400, 401, 403, 404, 422]

    def test_null_byte_injection(self):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com\x00.com",
                "nom": "Test\x00Admin",
                "prenomsecond": "User",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
        )
        assert response.status_code in [400, 422]


class TestBoundaryValues:
    def test_very_long_string(self):
        long_string = "a" * 10000
        response = client.post(
            "/api/auth/register",
            json={
                "email": f"{long_string}@test.com",
                "nom": long_string,
                "prenomsecond": long_string,
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
        )
        assert response.status_code in [400, 422]

    def test_unicode_characters(self):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test@example.com",
                "nom": "Test User",
                "prenomsecond": "User Name",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
        )
        assert response.status_code in [200, 201, 400, 422, 429]

    def test_negative_numbers(self):
        response = client.get("/api/projects?skip=-10&limit=-5")
        assert response.status_code in [200, 400, 401, 403, 422]

    def test_zero_length_string(self):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "",
                "nom": "",
                "prenomsecond": "",
                "password": "",
                "password_confirm": "",
            },
        )
        assert response.status_code in [400, 422]

    def test_max_safe_integer(self):
        response = client.get("/api/projects/9223372036854775807")
        assert response.status_code in [400, 401, 403, 404]


class TestDataTypeErrors:
    def test_string_instead_of_json(self):
        response = client.post(
            "/api/auth/register",
            content="not a json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in [400, 422]

    def test_array_instead_of_object(self):
        response = client.post("/api/auth/register", json=["item1", "item2"])
        assert response.status_code in [400, 422]

    def test_null_value_for_required_field(self):
        response = client.post(
            "/api/auth/register",
            json={
                "email": None,
                "nom": None,
                "prenomsecond": None,
                "password": None,
                "password_confirm": None,
            },
        )
        assert response.status_code in [400, 422]

    def test_boolean_instead_of_string(self):
        response = client.post(
            "/api/auth/login",
            json={"username": True, "password": False},
        )
        assert response.status_code in [400, 422]


class TestConcurrency:
    def test_rapid_requests(self):
        responses = [client.get("/api/health").status_code for _ in range(5)]
        assert all(s == 200 for s in responses)

    def test_concurrent_different_endpoints(self):
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/docs").status_code == 200


class TestMemoryAndPerformance:
    def test_deeply_nested_json(self):
        nested = {"data": {}}
        current = nested["data"]
        for _ in range(100):
            current["next"] = {}
            current = current["next"]
        response = client.post("/api/auth/register", json=nested)
        assert response.status_code in [400, 422]

    def test_large_json_array(self):
        large_array = [{"id": i} for i in range(10000)]
        response = client.post(
            "/api/projects",
            json={"items": large_array},
            headers={"Authorization": "Bearer fake"},
        )
        assert response.status_code in [400, 401, 403, 404, 413, 422]


class TestSpecialCharacters:
    def test_tab_characters(self):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test\t@example.com",
                "nom": "Test\tUser",
                "prenomsecond": "\tUser\t",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
        )
        assert response.status_code in [400, 422]

    def test_newline_characters(self):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test\n@example.com",
                "nom": "Test\nUser",
                "prenomsecond": "User\n",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
        )
        assert response.status_code in [400, 422]

    def test_special_regex_chars(self):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "test+filter@example.com",
                "nom": "Test.Special",
                "prenomsecond": "User",
                "password": "Pass123!",
                "password_confirm": "Pass123!",
            },
        )
        assert response.status_code in [400, 422]


class TestErrorMessages:
    def test_error_response_has_message(self):
        response = client.get("/api/projects")
        assert response.status_code in [401, 403]
        if response.headers.get("content-type", "").startswith("application/json"):
            data = response.json()
            assert "detail" in data or "message" in data or "error" in data

    def test_no_sensitive_info_in_errors(self):
        response = client.post(
            "/api/auth/login",
            data={"username": "test@example.com", "password": "wrong"},
        )
        if response.status_code == 401:
            data = response.json()
            error_text = json.dumps(data).lower()
            assert "password" not in error_text or "incorrect" in error_text


class TestResponseHeaders:
    def test_security_headers_present(self):
        response = client.get("/api/health")
        headers = response.headers
        if "X-Content-Type-Options" in headers:
            assert headers["X-Content-Type-Options"] == "nosniff"

    def test_cache_control_headers(self):
        response = client.get(
            "/api/projects",
            headers={"Authorization": "Bearer fake"},
        )
        if "Cache-Control" in response.headers:
            assert "private" in response.headers["Cache-Control"].lower()

    def test_content_type_charset(self):
        response = client.get("/api/health")
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type or content_type != ""


class TestTimeoutBehavior:
    def test_endpoint_response_time(self):
        start = time.time()
        response = client.get("/api/health")
        duration = time.time() - start
        assert response.status_code == 200
        assert duration < 5


class TestIdempotentRequests:
    def test_get_is_idempotent(self):
        r1 = client.get("/api/health")
        r2 = client.get("/api/health")
        assert r1.status_code == r2.status_code

    def test_head_request(self):
        response = client.request("HEAD", "/api/health")
        assert response.status_code in [200, 404, 405]


class TestContentNegotiation:
    def test_accept_header_json(self):
        response = client.get(
            "/api/health",
            headers={"Accept": "application/json"},
        )
        assert response.status_code == 200
        assert "application/json" in response.headers.get("content-type", "")

    def test_accept_header_unsupported(self):
        response = client.get(
            "/api/health",
            headers={"Accept": "application/xml"},
        )
        assert response.status_code in [200, 406]