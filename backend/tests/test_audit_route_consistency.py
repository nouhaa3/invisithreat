from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_admin_audit_log_route_prefix_is_single_api_prefix(setup_db):
    response = client.get("/api/admin/audit-logs")
    assert response.status_code != 404


def test_double_api_prefix_is_not_exposed(setup_db):
    response = client.get("/api/api/admin/audit-logs")
    assert response.status_code == 404
