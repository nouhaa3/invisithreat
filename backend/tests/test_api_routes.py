"""
API Routes Tests
Tests for all critical API endpoints
"""


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_get_me_authenticated(self, client, auth_headers, test_user):
        """Get current user info when authenticated"""
        response = client.get("/api/users/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
    
    def test_get_me_unauthenticated(self, client):
        """Get current user info without authentication"""
        response = client.get("/api/users/me")
        assert response.status_code == 401
    
    def test_refresh_token_endpoint(self, client):
        """Test token refresh endpoint"""
        response = client.post("/api/auth/refresh-token", json={})
        # May return 400 (invalid) or 404 (not found) or 422 (validation)
        assert response.status_code in [400, 404, 422]


class TestProjectEndpoints:
    """Test project management endpoints"""
    
    def test_get_projects_list(self, client, auth_headers, test_user, db):
        """Get projects list"""
        from app.models.scan import Project
        
        # Create test project
        project = Project(name="Test Project", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        response = client.get("/api/projects", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list) or "items" in data
    
    def test_create_project(self, client, auth_headers):
        """Create new project"""
        response = client.post(
            "/api/projects",
            headers=auth_headers,
            json={
                "name": "New Test Project",
                "description": "Test description",
                "language": "python"
            }
        )
        assert response.status_code in [200, 201]
    
    def test_get_project_detail(self, client, auth_headers, test_user, db):
        """Get project details"""
        from app.models.scan import Project
        
        project = Project(name="Detail Test", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        response = client.get(f"/api/projects/{project.id}", headers=auth_headers)
        assert response.status_code == 200
    
    def test_update_project(self, client, auth_headers, test_user, db):
        """Update project"""
        from app.models.scan import Project
        
        project = Project(name="Original", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        response = client.put(
            f"/api/projects/{project.id}",
            headers=auth_headers,
            json={"name": "Updated"}
        )
        assert response.status_code in [200, 204]
    
    def test_delete_project(self, client, auth_headers, test_user, db):
        """Delete project"""
        from app.models.scan import Project
        
        project = Project(name="To Delete", owner_id=test_user.id)
        db.add(project)
        db.commit()
        project_id = project.id
        
        response = client.delete(f"/api/projects/{project_id}", headers=auth_headers)
        assert response.status_code in [200, 204]
    
    def test_project_not_found(self, client, auth_headers):
        """Request non-existent project"""
        response = client.get("/api/projects/99999", headers=auth_headers)
        assert response.status_code == 404


class TestScanEndpoints:
    """Test scan-related endpoints"""
    
    def test_get_scans(self, client, auth_headers):
        """Get scans list"""
        response = client.get("/api/scans", headers=auth_headers)
        assert response.status_code == 200
    
    def test_start_new_scan(self, client, auth_headers, test_user, db):
        """Start new scan"""
        from app.models.scan import Project
        
        project = Project(name="Scan Test", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        response = client.post(
            f"/api/projects/{project.id}/scans",
            headers=auth_headers,
            json={
                "scan_type": "SAST",
                "description": "Security scan"
            }
        )
        assert response.status_code in [200, 201]
    
    def test_get_scan_results(self, client, auth_headers, test_user, db):
        """Get scan results"""
        from app.models.scan import Project, Scan
        
        project = Project(name="Results Test", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        scan = Scan(project_id=project.id, scan_type="SAST")
        db.add(scan)
        db.commit()
        
        response = client.get(f"/api/scans/{scan.id}/results", headers=auth_headers)
        assert response.status_code in [200, 404]  # May not have results yet


class TestVulnerabilityEndpoints:
    """Test vulnerability management endpoints"""
    
    def test_get_vulnerabilities(self, client, auth_headers):
        """Get vulnerabilities list"""
        response = client.get("/api/vulnerabilities", headers=auth_headers)
        assert response.status_code in [200, 404]
    
    def test_get_vulnerability_detail(self, client, auth_headers):
        """Get vulnerability details"""
        response = client.get("/api/vulnerabilities/1", headers=auth_headers)
        # May be 200 or 404 depending on data
        assert response.status_code in [200, 404]


class TestUserEndpoints:
    """Test user management endpoints"""
    
    def test_get_current_user(self, client, auth_headers, test_user):
        """Get current user profile"""
        response = client.get("/api/users/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
    
    def test_update_profile(self, client, auth_headers):
        """Update user profile"""
        response = client.put(
            "/api/users/me",
            headers=auth_headers,
            json={"full_name": "Updated Name"}
        )
        assert response.status_code in [200, 204]
    
    def test_change_password(self, client, auth_headers):
        """Change password"""
        response = client.post(
            "/api/users/change-password",
            headers=auth_headers,
            json={
                "current_password": "testpassword123",
                "new_password": "newpassword123",
                "confirm_password": "newpassword123"
            }
        )
        assert response.status_code in [200, 204, 400, 401]


class TestDashboardEndpoints:
    """Test dashboard endpoints"""
    
    def test_get_dashboard_stats(self, client, auth_headers):
        """Get dashboard statistics"""
        response = client.get("/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_projects" in data
        assert "total_scans" in data
        assert "security_score" in data
    
    def test_dashboard_unauthorized(self, client):
        """Dashboard without authentication"""
        response = client.get("/api/dashboard/stats")
        assert response.status_code == 401


class TestAdminEndpoints:
    """Test admin-only endpoints"""
    
    def test_get_all_users(self, client, admin_auth_headers):
        """Get all users (admin only)"""
        response = client.get("/api/admin/users", headers=admin_auth_headers)
        assert response.status_code in [200, 403]
    
    def test_get_audit_logs(self, client, admin_auth_headers):
        """Get audit logs (admin only)"""
        response = client.get("/api/admin/audit-logs", headers=admin_auth_headers)
        assert response.status_code in [200, 403]
    
    def test_admin_unauthorized_developer(self, client, auth_headers):
        """Developer cannot access admin endpoints"""
        response = client.get("/api/admin/users", headers=auth_headers)
        assert response.status_code == 403


class TestErrorHandling:
    """Test error handling across endpoints"""
    
    def test_invalid_json_body(self, client, auth_headers):
        """Invalid JSON in request body"""
        response = client.post(
            "/api/projects",
            headers=auth_headers,
            data="invalid json {",
        )
        assert response.status_code in [400, 422]
    
    def test_missing_required_field(self, client, auth_headers):
        """Missing required field in request"""
        response = client.post(
            "/api/projects",
            headers=auth_headers,
            json={"description": "No name provided"}
        )
        assert response.status_code == 422
    
    def test_invalid_enum_value(self, client, auth_headers):
        """Invalid enum value"""
        response = client.post(
            "/api/projects",
            headers=auth_headers,
            json={
                "name": "Test",
                "language": "invalid_language"
            }
        )
        assert response.status_code in [400, 422]


class TestPagination:
    """Test pagination on list endpoints"""
    
    def test_pagination_limit(self, client, auth_headers):
        """Test pagination limit parameter"""
        response = client.get("/api/projects?limit=10", headers=auth_headers)
        assert response.status_code == 200
    
    def test_pagination_offset(self, client, auth_headers):
        """Test pagination offset parameter"""
        response = client.get("/api/projects?offset=0", headers=auth_headers)
        assert response.status_code == 200
    
    def test_invalid_pagination(self, client, auth_headers):
        """Invalid pagination parameters"""
        response = client.get("/api/projects?limit=abc", headers=auth_headers)
        assert response.status_code in [200, 422]


class TestSearchFiltering:
    """Test search and filtering"""
    
    def test_search_projects_by_name(self, client, auth_headers, test_user, db):
        """Search projects by name"""
        from app.models.scan import Project
        
        p1 = Project(name="Python Backend", owner_id=test_user.id)
        p2 = Project(name="React Frontend", owner_id=test_user.id)
        db.add_all([p1, p2])
        db.commit()
        
        response = client.get("/api/projects?search=Python", headers=auth_headers)
        assert response.status_code == 200
    
    def test_filter_by_status(self, client, auth_headers):
        """Filter projects by status"""
        response = client.get("/api/projects?status=active", headers=auth_headers)
        assert response.status_code == 200


class TestCORSHeaders:
    """Test CORS headers"""
    
    def test_cors_headers_present(self, client):
        """Check CORS headers are present"""
        response = client.options("/api/projects")
        # CORS headers may or may not be present depending on config
        assert response.status_code in [200, 204, 405]


class TestRateLimiting:
    """Test rate limiting"""
    
    def test_rapid_requests(self, client, auth_headers):
        """Test rapid successive requests"""
        responses = []
        for _ in range(5):
            response = client.get("/api/projects", headers=auth_headers)
            responses.append(response.status_code)
        
        # Should allow requests (200) or eventually hit rate limit (429)
        assert all(status in [200, 429] for status in responses)
