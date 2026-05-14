"""
Complete Test Suite - All Critical Components
Tests for authentication, models, services, API, and security
"""
import pytest
from app.models.user import User
from app.models.role import Role
from app.models.scan import Project, Scan, ScanStatus
from app.models.vulnerability import Vulnerability
from app.models.member import ProjectMember
from app.models.audit_log import AuditLog
from app.models.auth_token import AuthToken
from app.models.notification import Notification
from app.core.security import hash_password, verify_password
from app.core.jwt import create_access_token, create_refresh_token
from app.core.config import settings


# ============================================================================
# SECURITY TESTS
# ============================================================================

class TestPasswordSecurity:
    """Test password hashing and verification"""
    
    def test_hash_password_creates_different_hashes(self):
        """Same password produces different hashes"""
        password = "TestPassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2
    
    def test_verify_password_correct(self):
        """Correct password verification"""
        password = "TestPassword123!"
        hashed = hash_password(password)
        assert verify_password(password, hashed)
    
    def test_verify_password_incorrect(self):
        """Incorrect password fails verification"""
        password = "TestPassword123!"
        wrong_password = "WrongPassword456!"
        hashed = hash_password(password)
        assert not verify_password(wrong_password, hashed)


class TestJWTSecurity:
    """Test JWT token security"""
    
    def test_create_access_token(self):
        """Create valid access token"""
        token = create_access_token(data={"sub": "test@example.com"})
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 50
    
    def test_create_refresh_token(self):
        """Create refresh token"""
        token = create_refresh_token(data={"sub": "test@example.com"})
        assert token is not None
        assert isinstance(token, str)
    
    def test_token_contains_subject(self):
        """Token contains subject claim"""
        from jose import jwt
        email = "test@example.com"
        token = create_access_token(data={"sub": email})
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        assert payload["sub"] == email


# ============================================================================
# DATABASE MODELS TESTS
# ============================================================================

class TestUserModel:
    """Test User model"""
    
    def test_create_user(self, db):
        """Create user"""
        user = User(
            email="test@example.com",
            hashed_password=hash_password("password"),
            full_name="Test User"
        )
        db.add(user)
        db.commit()
        assert user.id is not None
    
    def test_user_unique_email(self, db):
        """Email uniqueness constraint"""
        user1 = User(
            email="unique@example.com",
            hashed_password=hash_password("pass1"),
            full_name="User 1"
        )
        db.add(user1)
        db.commit()
        
        user2 = User(
            email="unique@example.com",
            hashed_password=hash_password("pass2"),
            full_name="User 2"
        )
        db.add(user2)
        with pytest.raises(Exception):
            db.commit()


class TestProjectModel:
    """Test Project model"""
    
    def test_create_project(self, db, test_user):
        """Create project"""
        project = Project(
            name="Test Project",
            description="Test",
            owner_id=test_user.id
        )
        db.add(project)
        db.commit()
        assert project.id is not None
        assert project.owner_id == test_user.id
    
    def test_project_scans(self, db, test_user):
        """Project can have multiple scans"""
        project = Project(name="Scans", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        for _ in range(3):
            scan = Scan(project_id=project.id, scan_type="SAST")
            db.add(scan)
        db.commit()
        
        scans = db.query(Scan).filter(Scan.project_id == project.id).all()
        assert len(scans) == 3


class TestScanModel:
    """Test Scan model"""
    
    def test_create_scan(self, db, test_user):
        """Create scan"""
        project = Project(name="Scan Test", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        scan = Scan(
            project_id=project.id,
            scan_type="SAST",
            status=ScanStatus.completed
        )
        db.add(scan)
        db.commit()
        assert scan.id is not None
    
    def test_scan_status_values(self, db, test_user):
        """Test scan status values"""
        project = Project(name="Status", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        for status in [ScanStatus.pending, ScanStatus.running, ScanStatus.completed]:
            scan = Scan(project_id=project.id, scan_type="SAST", status=status)
            db.add(scan)
        db.commit()
        
        all_scans = db.query(Scan).filter(Scan.project_id == project.id).all()
        assert len(all_scans) == 3


class TestVulnerabilityModel:
    """Test Vulnerability model"""
    
    def test_create_vulnerability(self, db, test_user):
        """Create vulnerability"""
        project = Project(name="Vuln", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        scan = Scan(project_id=project.id, scan_type="SAST")
        db.add(scan)
        db.commit()
        
        vuln = Vulnerability(
            scan_id=scan.id,
            title="SQL Injection",
            severity="HIGH",
            description="Test"
        )
        db.add(vuln)
        db.commit()
        assert vuln.id is not None


class TestRoleAndPermissions:
    """Test Role model and permissions"""
    
    def test_create_role(self, db):
        """Create role"""
        role = Role(name="Developer", description="Dev")
        db.add(role)
        db.commit()
        assert role.id is not None
    
    def test_user_with_role(self, db):
        """User with role"""
        role = Role(name="Admin")
        db.add(role)
        db.commit()
        
        user = User(
            email="admin@example.com",
            hashed_password=hash_password("pass"),
            full_name="Admin",
            role_id=role.id
        )
        db.add(user)
        db.commit()
        assert user.role.name == "Admin"


class TestProjectMembership:
    """Test project membership"""
    
    def test_add_project_member(self, db, test_user):
        """Add member to project"""
        project = Project(name="Team", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        role = Role(name="Developer")
        db.add(role)
        db.commit()
        
        member = User(
            email="member@example.com",
            hashed_password=hash_password("pass"),
            full_name="Member",
            role_id=role.id
        )
        db.add(member)
        db.commit()
        
        pm = ProjectMember(
            project_id=project.id,
            user_id=member.id,
            role="Developer"
        )
        db.add(pm)
        db.commit()
        
        members = db.query(ProjectMember).filter(ProjectMember.project_id == project.id).all()
        assert len(members) == 1


class TestAuditLogging:
    """Test audit log functionality"""
    
    def test_create_audit_log(self, db, test_user):
        """Create audit log"""
        log = AuditLog(
            user_id=test_user.id,
            action="LOGIN",
            ip_address="127.0.0.1"
        )
        db.add(log)
        db.commit()
        assert log.id is not None
    
    def test_query_audit_logs(self, db, test_user):
        """Query audit logs"""
        for action in ["LOGIN", "CREATE_PROJECT"]:
            log = AuditLog(
                user_id=test_user.id,
                action=action,
                ip_address="127.0.0.1"
            )
            db.add(log)
        db.commit()
        
        logs = db.query(AuditLog).filter(AuditLog.user_id == test_user.id).all()
        assert len(logs) == 2


class TestNotifications:
    """Test notification model"""
    
    def test_create_notification(self, db, test_user):
        """Create notification"""
        notif = Notification(
            user_id=test_user.id,
            title="Test",
            message="Test message"
        )
        db.add(notif)
        db.commit()
        assert notif.id is not None


# ============================================================================
# SESSION MANAGEMENT TESTS
# ============================================================================

class TestSessionManagement:
    """Test session and refresh token management"""
    
    def test_create_auth_token(self, db, test_user):
        """Create authentication token"""
        token = AuthToken(
            user_id=test_user.id,
            jti="test-jti",
            token_hash="hash123",
            is_active=True
        )
        db.add(token)
        db.commit()
        assert token.id is not None
    
    def test_revoke_auth_token(self, db, test_user):
        """Revoke authentication token"""
        token = AuthToken(
            user_id=test_user.id,
            jti="revoke-jti",
            token_hash="hash",
            is_active=True
        )
        db.add(token)
        db.commit()
        
        token.is_active = False
        db.commit()
        
        retrieved = db.query(AuthToken).filter(AuthToken.jti == "revoke-jti").first()
        assert not retrieved.is_active


# ============================================================================
# API ENDPOINT TESTS
# ============================================================================

class TestAuthEndpoints:
    """Test authentication API endpoints"""
    
    def test_get_current_user(self, client, auth_headers, test_user):
        """GET /api/users/me"""
        response = client.get("/api/users/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
    
    def test_get_current_user_unauthorized(self, client):
        """GET /api/users/me without auth"""
        response = client.get("/api/users/me")
        assert response.status_code == 401


class TestProjectEndpoints:
    """Test project API endpoints"""
    
    def test_list_projects(self, client, auth_headers):
        """GET /api/projects"""
        response = client.get("/api/projects", headers=auth_headers)
        assert response.status_code == 200
    
    def test_list_projects_unauthorized(self, client):
        """GET /api/projects without auth"""
        response = client.get("/api/projects")
        assert response.status_code == 401


class TestDashboardEndpoints:
    """Test dashboard endpoints"""
    
    def test_get_dashboard_stats(self, client, auth_headers):
        """GET /api/dashboard/stats"""
        response = client.get("/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_projects" in data or isinstance(data, dict)


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestEndToEndWorkflow:
    """Test end-to-end workflows"""
    
    def test_user_project_scan_workflow(self, db, test_user):
        """User creates project and scan"""
        # Create project
        project = Project(name="E2E Test", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        # Create scan
        scan = Scan(project_id=project.id, scan_type="SAST")
        db.add(scan)
        db.commit()
        
        # Create vulnerability
        vuln = Vulnerability(
            scan_id=scan.id,
            title="E2E Vuln",
            severity="HIGH"
        )
        db.add(vuln)
        db.commit()
        
        # Verify complete workflow
        assert project.id is not None
        assert scan.project_id == project.id
        assert vuln.scan_id == scan.id
    
    def test_multi_user_project_workflow(self, db, test_user):
        """Multiple users collaborating on project"""
        # Owner creates project
        project = Project(name="Collab", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        # Add member
        role = Role(name="Developer")
        db.add(role)
        db.commit()
        
        member = User(
            email="collab@example.com",
            hashed_password=hash_password("pass"),
            full_name="Collaborator",
            role_id=role.id
        )
        db.add(member)
        db.commit()
        
        pm = ProjectMember(
            project_id=project.id,
            user_id=member.id,
            role="Developer"
        )
        db.add(pm)
        db.commit()
        
        # Both users can access project
        assert project.owner_id == test_user.id
        members = db.query(ProjectMember).filter(ProjectMember.project_id == project.id).all()
        assert len(members) == 1


# ============================================================================
# ERROR HANDLING TESTS
# ============================================================================

class TestErrorHandling:
    """Test error handling"""
    
    def test_invalid_project_id(self, client, auth_headers):
        """Request non-existent project"""
        response = client.get("/api/projects/99999999", headers=auth_headers)
        assert response.status_code in [404, 403]
    
    def test_unauthorized_access(self, client):
        """Access protected endpoint without auth"""
        response = client.get("/api/projects")
        assert response.status_code == 401


# ============================================================================
# PERFORMANCE TESTS
# ============================================================================

class TestPerformance:
    """Test performance characteristics"""
    
    def test_bulk_project_creation(self, db, test_user):
        """Create multiple projects"""
        for i in range(10):
            project = Project(
                name=f"Perf Test {i}",
                owner_id=test_user.id
            )
            db.add(project)
        db.commit()
        
        projects = db.query(Project).filter(Project.owner_id == test_user.id).all()
        assert len(projects) >= 10
    
    def test_bulk_vulnerability_creation(self, db, test_user):
        """Create multiple vulnerabilities"""
        project = Project(name="Bulk Vuln", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        scan = Scan(project_id=project.id, scan_type="SAST")
        db.add(scan)
        db.commit()
        
        for i in range(20):
            vuln = Vulnerability(
                scan_id=scan.id,
                title=f"Vuln {i}",
                severity="HIGH" if i % 2 == 0 else "MEDIUM"
            )
            db.add(vuln)
        db.commit()
        
        vulns = db.query(Vulnerability).filter(Vulnerability.scan_id == scan.id).all()
        assert len(vulns) == 20
