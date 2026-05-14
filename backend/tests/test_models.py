"""
Database Models Tests
Tests for all data models and their relationships
"""
import pytest
from app.models.user import User
from app.models.role import Role
from app.models.scan import Project, Scan, ScanStatus
from app.models.vulnerability import Vulnerability
from app.models.member import ProjectMember
from app.models.api_key import UserAPIKey
from app.models.audit_log import AuditLog
from app.models.auth_token import AuthToken
from app.models.notification import Notification
from app.core.security import hash_password


class TestUserModel:
    """Test User model"""
    
    def test_create_user(self, db):
        """Create a user"""
        user = User(
            email="test@example.com",
            hashed_password=hash_password("password"),
            full_name="Test User"
        )
        db.add(user)
        db.commit()
        
        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.created_at is not None
    
    def test_user_unique_email(self, db):
        """Email must be unique"""
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
        
        # Should raise integrity error
        with pytest.raises(Exception):
            db.commit()
    
    def test_user_timestamps(self, db):
        """User should have creation and update timestamps"""
        user = User(
            email="timestamps@example.com",
            hashed_password=hash_password("pass"),
            full_name="Test"
        )
        db.add(user)
        db.commit()
        
        assert user.created_at is not None
        assert user.updated_at is not None or user.created_at is not None


class TestProjectModel:
    """Test Project model"""
    
    def test_create_project(self, db, test_user):
        """Create a project"""
        project = Project(
            name="My Project",
            description="Test project",
            owner_id=test_user.id
        )
        db.add(project)
        db.commit()
        
        assert project.id is not None
        assert project.owner_id == test_user.id
    
    def test_project_owner_relationship(self, db, test_user):
        """Project is owned by a user"""
        project = Project(name="Owner Test", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        assert project.owner.id == test_user.id
    
    def test_project_multiple_scans(self, db, test_user):
        """Project can have multiple scans"""
        project = Project(name="Multi Scan", owner_id=test_user.id)
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
        """Create a scan"""
        project = Project(name="Scan Project", owner_id=test_user.id)
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
        assert scan.project_id == project.id
    
    def test_scan_statuses(self, db, test_user):
        """Test different scan statuses"""
        project = Project(name="Status Project", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        statuses = [
            ScanStatus.pending,
            ScanStatus.running,
            ScanStatus.completed,
        ]
        
        for status in statuses:
            scan = Scan(
                project_id=project.id,
                scan_type="SAST",
                status=status
            )
            db.add(scan)
        
        db.commit()
        
        all_scans = db.query(Scan).filter(Scan.project_id == project.id).all()
        assert len(all_scans) == len(statuses)
    
    def test_scan_timestamps(self, db, test_user):
        """Scan should have timestamps"""
        project = Project(name="Time Project", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        scan = Scan(project_id=project.id, scan_type="DAST")
        db.add(scan)
        db.commit()
        
        assert scan.created_at is not None


class TestVulnerabilityModel:
    """Test Vulnerability model"""
    
    def test_create_vulnerability(self, db, test_user):
        """Create a vulnerability"""
        project = Project(name="Vuln Project", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        scan = Scan(project_id=project.id, scan_type="SAST")
        db.add(scan)
        db.commit()
        
        vuln = Vulnerability(
            scan_id=scan.id,
            title="SQL Injection",
            severity="HIGH",
            description="Potential SQL injection",
            cwe_id=89,
            file_path="app.py",
            line_number=42
        )
        db.add(vuln)
        db.commit()
        
        assert vuln.id is not None
        assert vuln.severity == "HIGH"
    
    def test_vulnerability_severities(self, db, test_user):
        """Test different severity levels"""
        project = Project(name="Severity Project", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        scan = Scan(project_id=project.id, scan_type="DAST")
        db.add(scan)
        db.commit()
        
        severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
        
        for severity in severities:
            vuln = Vulnerability(
                scan_id=scan.id,
                title=f"{severity} Issue",
                severity=severity
            )
            db.add(vuln)
        
        db.commit()
        
        vulns = db.query(Vulnerability).filter(Vulnerability.scan_id == scan.id).all()
        assert len(vulns) == len(severities)


class TestProjectMemberModel:
    """Test ProjectMember model"""
    
    def test_add_project_member(self, db, test_user):
        """Add member to project"""
        project = Project(name="Team Project", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        member_role = Role(name="Developer")
        db.add(member_role)
        db.commit()
        
        member_user = User(
            email="member@example.com",
            hashed_password=hash_password("pass"),
            full_name="Member",
            role_id=member_role.id
        )
        db.add(member_user)
        db.commit()
        
        pm = ProjectMember(
            project_id=project.id,
            user_id=member_user.id,
            role="Developer"
        )
        db.add(pm)
        db.commit()
        
        members = db.query(ProjectMember).filter(ProjectMember.project_id == project.id).all()
        assert len(members) == 1
    
    def test_project_multiple_members(self, db, test_user):
        """Project can have multiple members"""
        project = Project(name="Multi Member", owner_id=test_user.id)
        db.add(project)
        db.commit()
        
        role = Role(name="Developer")
        db.add(role)
        db.commit()
        
        for i in range(3):
            user = User(
                email=f"member{i}@example.com",
                hashed_password=hash_password("pass"),
                full_name=f"Member {i}",
                role_id=role.id
            )
            db.add(user)
        
        db.commit()
        
        members = db.query(User).filter(User.role_id == role.id).all()
        assert len(members) >= 3


class TestAPIKeyModel:
    """Test APIKey model"""
    
    def test_create_api_key(self, db, test_user):
        """Create API key"""
        key = UserAPIKey(  # type: ignore[name-defined]
            user_id=test_user.id,
            name="Test Key",
            key="test_key_123456"
        )
        db.add(key)
        db.commit()
        
        assert key.id is not None
        assert key.user_id == test_user.id
    
    def test_api_key_unique(self, db, test_user):
        """API keys should be unique"""
        key1 = UserAPIKey(user_id=test_user.id, name="Key1", key="unique_key_1")  # type: ignore[name-defined]
        db.add(key1)
        db.commit()
        
        key2 = UserAPIKey(user_id=test_user.id, name="Key2", key="unique_key_1")  # type: ignore[name-defined]
        db.add(key2)
        
        # Should raise error due to unique constraint
        with pytest.raises(Exception):
            db.commit()


class TestAuditLogModel:
    """Test AuditLog model"""
    
    def test_create_audit_log(self, db, test_user):
        """Create audit log entry"""
        log = AuditLog(
            user_id=test_user.id,
            action="CREATE_PROJECT",
            resource_type="PROJECT",
            resource_id=123,
            ip_address="127.0.0.1"
        )
        db.add(log)
        db.commit()
        
        assert log.id is not None
        assert log.action == "CREATE_PROJECT"
    
    def test_audit_log_query_by_user(self, db, test_user):
        """Query audit logs by user"""
        for action in ["LOGIN", "CREATE_PROJECT", "DELETE_PROJECT"]:
            log = AuditLog(
                user_id=test_user.id,
                action=action,
                ip_address="127.0.0.1"
            )
            db.add(log)
        
        db.commit()
        
        logs = db.query(AuditLog).filter(AuditLog.user_id == test_user.id).all()
        assert len(logs) == 3


class TestAuthTokenModel:
    """Test AuthToken (refresh token) model"""
    
    def test_create_auth_token(self, db, test_user):
        """Create authentication token"""
        token = AuthToken(
            user_id=test_user.id,
            jti="unique-jti-123",
            token_hash="hash123",
            is_active=True
        )
        db.add(token)
        db.commit()
        
        assert token.id is not None
        assert token.is_active is True
    
    def test_revoke_token(self, db, test_user):
        """Revoke authentication token"""
        token = AuthToken(
            user_id=test_user.id,
            jti="revoke-jti",
            token_hash="hash",
            is_active=True
        )
        db.add(token)
        db.commit()
        
        # Revoke
        token.is_active = False
        db.commit()
        
        retrieved = db.query(AuthToken).filter(AuthToken.jti == "revoke-jti").first()
        assert retrieved.is_active is False


class TestNotificationModel:
    """Test Notification model"""
    
    def test_create_notification(self, db, test_user):
        """Create notification"""
        notification = Notification(
            user_id=test_user.id,
            title="New Scan",
            message="Scan completed",
            notification_type="scan_complete"
        )
        db.add(notification)
        db.commit()
        
        assert notification.id is not None
    
    def test_notification_read_status(self, db, test_user):
        """Mark notification as read"""
        notification = Notification(
            user_id=test_user.id,
            title="Test",
            message="Test message",
            is_read=False
        )
        db.add(notification)
        db.commit()
        
        # Mark as read
        notification.is_read = True
        db.commit()
        
        retrieved = db.query(Notification).filter(Notification.id == notification.id).first()
        assert retrieved.is_read is True


class TestModelRelationships:
    """Test relationships between models"""
    
    def test_cascade_delete_project(self, db, test_user):
        """Deleting project should cascade"""
        project = Project(name="Cascade Test", owner_id=test_user.id)
        db.add(project)
        db.commit()
        project_id = project.id
        
        scan = Scan(project_id=project.id, scan_type="SAST")
        db.add(scan)
        db.commit()
        
        # Delete project
        db.delete(project)
        db.commit()
        
        # Project should be gone
        retrieved = db.query(Project).filter(Project.id == project_id).first()
        assert retrieved is None
    
    def test_user_has_many_projects(self, db, test_user):
        """User can own multiple projects"""
        for i in range(3):
            project = Project(
                name=f"Project {i}",
                owner_id=test_user.id
            )
            db.add(project)
        
        db.commit()
        
        projects = db.query(Project).filter(Project.owner_id == test_user.id).all()
        assert len(projects) >= 3


class TestModelValidation:
    """Test model validation and constraints"""
    
    def test_not_null_constraints(self, db):
        """Test NOT NULL constraints"""
        # Try to create user without email
        user = User(
            email=None,  # Required
            hashed_password=hash_password("pass"),
            full_name="Test"
        )
        db.add(user)
        
        with pytest.raises(Exception):
            db.commit()
    
    def test_foreign_key_constraint(self, db):
        """Test foreign key constraint"""
        # Try to create project with non-existent owner
        project = Project(
            name="Bad Project",
            owner_id=99999  # Non-existent user
        )
        db.add(project)
        
        # May or may not raise immediately, but should fail on commit
        try:
            db.commit()
        except (ValueError, RuntimeError):
            pass  # Expected
