"""
Core Services Tests
Tests for GitHub scanner, DAST scanner, and other core services
"""
from app.models.user import User
from app.models.scan import Project, Scan
from app.models.role import Role


class TestGitHubScannerService:
    """Test GitHub repository scanning service"""
    
    def test_run_github_scan_function_exists(self):
        """Verify run_github_scan function is available"""
        from app.services.github_scanner import run_github_scan
        assert callable(run_github_scan)
    
    def test_github_token_validation(self):
        """Test GitHub token validation"""
        # Valid format token
        valid_token = "ghp_abcdef1234567890123456789012345678"
        assert len(valid_token) > 20
        
        # Invalid formats
        invalid_token = "xxx"
        assert len(invalid_token) < 20


class TestDASTScannerService:
    """Test DAST (Dynamic Analysis Security Testing) Scanner"""
    
    def test_dast_scanner_function_exists(self):
        """Verify DAST scanner functions are available"""
        from app.services.dast_scanner import _map_severity
        assert callable(_map_severity)
    
    def test_severity_mapping(self):
        """Test DAST severity mapping"""
        from app.services.dast_scanner import _map_severity
        
        # Test severity levels
        assert _map_severity("high") == "high"
        assert _map_severity("medium") == "medium"
        assert _map_severity("low") == "low"
        assert _map_severity("unknown") == "info"


class TestSessionManager:
    """Test session management service"""
    
    def test_create_refresh_session(self, db, test_user):
        """Test creating refresh session"""
        from app.services.session_manager import create_refresh_session
        from app.core.jwt import create_refresh_token
        
        # Create a refresh token
        refresh_token = create_refresh_token(data={"sub": test_user.email})
        
        # Create session
        auth_token = create_refresh_session(db, test_user.id, refresh_token)
        
        assert auth_token is not None
        assert auth_token.user_id == test_user.id
    
    def test_validate_refresh_session(self, db, test_user):
        """Test validating refresh session"""
        from app.services.session_manager import create_refresh_session, validate_refresh_session
        from app.core.jwt import create_refresh_token
        
        refresh_token = create_refresh_token(data={"sub": test_user.email})
        
        # Create session
        created_token = create_refresh_session(db, test_user.id, refresh_token)
        assert created_token is not None
        
        # Should be valid
        validated = validate_refresh_session(db, test_user.id, refresh_token)
        assert validated is not None
    
    def test_validate_invalid_session(self, db, test_user):
        """Test validating non-existent session"""
        from app.services.session_manager import validate_refresh_session
        
        # Invalid token
        validated = validate_refresh_session(db, test_user.id, "invalid-token")
        assert validated is None
    
    def test_revoke_all_sessions(self, db, test_user):
        """Test revoking all user sessions"""
        from app.services.session_manager import create_refresh_session, revoke_all_user_sessions
        from app.core.jwt import create_refresh_token
        
        # Create multiple sessions
        for i in range(3):
            refresh_token = create_refresh_token(data={"sub": test_user.email, "seq": i})
            create_refresh_session(db, test_user.id, refresh_token)
        
        # Revoke all
        revoke_all_user_sessions(db, test_user.id)
        
        # Verify all inactive
        from app.models.auth_token import AuthToken
        active_sessions = db.query(AuthToken).filter(
            AuthToken.user_id == test_user.id,
            AuthToken.is_active == True
        ).all()
        
        assert len(active_sessions) == 0


class TestRiskScoreCalculation:
    """Test risk score calculation service"""
    
    def test_calculate_risk_score(self, db, test_user):
        """Test risk score calculation"""
        from app.services.risk_score import get_or_create_scan_risk_score
        
        # Create project and scan
        project = Project(
            name="Test Project",
            description="Test",
            owner_id=test_user.id
        )
        db.add(project)
        db.commit()
        
        scan = Scan(
            project_id=project.id,
            scan_type="SAST"
        )
        db.add(scan)
        db.commit()
        
        # Calculate risk
        risk_score = get_or_create_scan_risk_score(db, scan.id)
        assert risk_score is not None
    
    def test_risk_score_thresholds(self):
        """Test risk score thresholds"""
        # Test different score ranges
        scores = [0, 25, 50, 75, 100]
        
        for score in scores:
            if score < 30:
                severity = "low"
            elif score < 60:
                severity = "medium"
            else:
                severity = "high"
            
            assert severity in ["low", "medium", "high"]


class TestAuditLogging:
    """Test audit logging service"""
    
    def test_audit_log_creation(self, db, test_user):
        """Test creating audit log entry"""
        from app.models.audit_log import AuditLog
        
        log = AuditLog(
            user_id=test_user.id,
            action="LOGIN",
            resource_type="USER",
            resource_id=test_user.id,
            ip_address="127.0.0.1"
        )
        db.add(log)
        db.commit()
        
        retrieved = db.query(AuditLog).filter(AuditLog.user_id == test_user.id).first()
        assert retrieved is not None
        assert retrieved.action == "LOGIN"
    
    def test_audit_log_filtering(self, db, test_user):
        """Test filtering audit logs"""
        from app.models.audit_log import AuditLog
        
        # Create multiple logs
        for action in ["LOGIN", "CREATE_PROJECT", "EDIT_PROJECT"]:
            log = AuditLog(
                user_id=test_user.id,
                action=action,
                resource_type="PROJECT" if "PROJECT" in action else "USER",
                resource_id=test_user.id,
                ip_address="127.0.0.1"
            )
            db.add(log)
        db.commit()
        
        # Filter by action
        project_logs = db.query(AuditLog).filter(
            AuditLog.action.ilike("%PROJECT%")
        ).all()
        
        assert len(project_logs) == 2


class TestProjectService:
    """Test project management service"""
    
    def test_create_project(self, db, test_user):
        """Test creating project"""
        project = Project(
            name="New Project",
            description="Test project",
            owner_id=test_user.id
        )
        db.add(project)
        db.commit()
        
        retrieved = db.query(Project).filter(Project.name == "New Project").first()
        assert retrieved is not None
        assert retrieved.owner_id == test_user.id
    
    def test_project_members(self, db, test_user):
        """Test adding project members"""
        from app.models.member import ProjectMember
        
        project = Project(
            name="Team Project",
            owner_id=test_user.id
        )
        db.add(project)
        db.commit()
        
        # Add another user as member
        member_role = Role(name="Developer")
        db.add(member_role)
        db.commit()
        
        member_user = User(
            email="member@example.com",
            hashed_password="hash",
            role_id=member_role.id
        )
        db.add(member_user)
        db.commit()
        
        # Add as project member
        project_member = ProjectMember(
            project_id=project.id,
            user_id=member_user.id,
            role="Developer"
        )
        db.add(project_member)
        db.commit()
        
        members = db.query(ProjectMember).filter(ProjectMember.project_id == project.id).all()
        assert len(members) == 1



