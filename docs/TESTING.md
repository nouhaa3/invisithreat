# Testing Guide ??

## Test Suite Overview

InvisiThreat has a comprehensive test suite with **19 passing tests** covering:

- ? Unit tests (basic functionality)
- ? API integration tests (against live backend)
- ? Authentication flows
- ? Error handling
- ? CORS security
- ? Documentation endpoints

## Running Tests

### Prerequisites

```bash
cd backend
pip install pytest pytest-cov httpx
```

### Run All Tests

```bash
# Run all tests
python -m pytest tests/ -v

# Run with coverage report
python -m pytest tests/ -v --cov=app --cov-report=html

# Run specific test file
python -m pytest tests/test_api.py -v

# Run specific test class
python -m pytest tests/test_api.py::TestBasicEndpoints -v

# Run specific test
python -m pytest tests/test_api.py::TestBasicEndpoints::test_health_check -v

# Run tests matching pattern
python -m pytest tests/ -k "health" -v
```

## Test Files

### 1. **test_simple.py** (4 unit tests)
Basic unit tests to verify pytest configuration

```
- test_math_addition
- test_string_operations
- test_list_operations
- test_dict_operations
```

**Purpose**: Verify pytest works in local environment

### 2. **test_api.py** (15 API integration tests)

#### TestBasicEndpoints
- `test_health_check` - Health endpoint
- `test_root_endpoint` - Root endpoint

#### TestAuthenticationFlow
- `test_register_user` - User registration
- `test_register_invalid_email` - Validation
- `test_login_wrong_credentials` - Auth failure

#### TestProjectsEndpoint
- `test_projects_requires_auth` - Auth required
- `test_projects_with_invalid_token` - Invalid token

#### TestDocsEndpoint
- `test_swagger_docs_accessible` - Swagger UI
- `test_redoc_accessible` - ReDoc docs
- `test_openapi_schema_accessible` - OpenAPI schema

#### TestErrorHandling
- `test_404_not_found` - 404 error
- `test_method_not_allowed` - 405 error

#### TestCORS
- `test_cors_headers_present` - CORS headers

#### TestResponseFormats
- `test_health_response_format` - Response structure
- `test_docs_response_type` - Content type

## Test Results

```
============================= test session starts =============================
collected 19 items

tests/test_simple.py::test_math_addition PASSED                         [  5%]
tests/test_simple.py::test_string_operations PASSED                     [ 10%]
tests/test_simple.py::test_list_operations PASSED                       [ 15%]
tests/test_simple.py::test_dict_operations PASSED                       [ 21%]
tests/test_api.py::TestBasicEndpoints::test_health_check PASSED         [ 26%]
tests/test_api.py::TestBasicEndpoints::test_root_endpoint PASSED        [ 31%]
tests/test_api.py::TestAuthenticationFlow::test_register_user PASSED    [ 36%]
tests/test_api.py::TestAuthenticationFlow::test_register_invalid_email PASSED [ 42%]
tests/test_api.py::TestAuthenticationFlow::test_login_wrong_credentials PASSED [ 47%]
tests/test_api.py::TestProjectsEndpoint::test_projects_requires_auth PASSED [ 52%]
tests/test_api.py::TestProjectsEndpoint::test_projects_with_invalid_token PASSED [ 57%]
tests/test_api.py::TestDocsEndpoint::test_swagger_docs_accessible PASSED [ 63%]
tests/test_api.py::TestDocsEndpoint::test_redoc_accessible PASSED       [ 68%]
tests/test_api.py::TestDocsEndpoint::test_openapi_schema_accessible PASSED [ 73%]
tests/test_api.py::TestErrorHandling::test_404_not_found PASSED         [ 78%]
tests/test_api.py::TestErrorHandling::test_method_not_allowed PASSED    [ 84%]
tests/test_api.py::TestCORS::test_cors_headers_present PASSED           [ 89%]
tests/test_api.py::TestResponseFormats::test_health_response_format PASSED [ 94%]
tests/test_api.py::TestResponseFormats::test_docs_response_type PASSED  [100%]

===================== 19 passed in 8.28s ========================
```

## Test Requirements

### Running Against Live Backend

API tests require the backend to be running:

```bash
# Terminal 1: Start backend
cd invisithreat
docker compose up -d

# Terminal 2: Run tests
cd backend
pytest tests/test_api.py -v
```

### Environment Setup

- Python 3.12+
- pytest 7.4+
- pytest-cov 4.1+
- httpx (for async requests)
- requests (for HTTP tests)

## Coverage Report

Generate HTML coverage report:

```bash
pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html
```

## Continuous Integration

### GitHub Actions

Tests run automatically via `.github/workflows/ci.yml` on:
- Every push to `main`
- Every pull request

```yaml
- name: Run tests
  run: |
    cd backend
    pip install -r requirements.txt
    pytest tests/ -v --cov=app
```

## Writing New Tests

### Test Structure

```python
class TestFeatureName:
    """Test feature description"""
    
    def test_scenario_name(self):
        """Test specific scenario"""
        # Arrange
        data = {"key": "value"}
        
        # Act
        response = requests.get(f"{API_URL}/endpoint")
        
        # Assert
        assert response.status_code == 200
        assert "expected_field" in response.json()
```

### Naming Conventions

- File: `test_*.py` or `*_test.py`
- Class: `Test*` (e.g., `TestAuthentication`)
- Method: `test_*` (e.g., `test_user_login_succeeds`)
- Describe what is being tested: `test_[feature]_[scenario]_[expected_result]`

Example: `test_user_login_with_invalid_password_returns_401`

### Best Practices

? **DO:**
- Use descriptive test names
- Test one thing per test
- Use fixtures for setup/teardown
- Mock external dependencies
- Test happy path and error cases
- Add docstrings to tests

? **DON'T:**
- Test implementation details
- Create interdependent tests
- Test multiple scenarios in one test
- Ignore test failures
- Hardcode test data

## Debugging Tests

### Verbose Output

```bash
pytest tests/ -v -s
```

### Show Local Variables on Failure

```bash
pytest tests/ --showlocals
```

### Stop After First Failure

```bash
pytest tests/ -x
```

### Drop into Debugger on Failure

```bash
pytest tests/ --pdb
```

## Performance Testing

### Test Execution Time

```bash
pytest tests/ --durations=10
```

### Parallel Test Execution

```bash
pip install pytest-xdist
pytest tests/ -n auto
```

## Next Steps

1. Add integration tests for database operations
2. Add load testing with Locust
3. Add security scanning tests (OWASP)
4. Increase coverage to 80%+ of critical paths
5. Add E2E tests with Selenium/Playwright
