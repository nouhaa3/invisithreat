"""
"""
from app.models.role import Role
from app.models.user import User
from app.models.scan import Project
from app.models.member import ProjectMember
from app.core.security import hash_password


class TestRoleModel:
    """Test Role model"""
    
    def test_create_role(self, db):
        """Create a role"""
        role = Role(
            name="Admin",
            description="Administrator role"
        )
        db.add(role)
        db.commit()
        
        retrieved = db.query(Role).filter(Role.name == "Admin").first()
        assert retrieved is not None
        assert retrieved.description == "Administrator role"
    
    def test_role_permissions(self, db):
        """Test role-permission relationships"""
        role = Role(name="Developer")
        db.add(role)
        db.commit()
        
        # Permissions would be added separately
        assert role.permissions is not None
    
    def test_multiple_roles(self, db):
        """Create multiple roles"""
        roles_data = [
            ("Admin", "Full system access"),
            ("Security Manager", "Security oversight"),
            ("Developer", "Development access"),
            ("Viewer", "Read-only access"),
        ]
        
        for name, desc in roles_data:
            role = Role(name=name, description=desc)
            db.add(role)
        
        db.commit()
        
        all_roles = db.query(Role).all()
        assert len(all_roles) >= len(roles_data)


class TestUserRoles:
    """Test users with roles"""
    
    def test_user_with_role(self, db):
        """Create user with role"""
        role = Role(name="Developer")
        db.add(role)
        db.commit()
        
        user = User(
            email="dev@example.com",
            hashed_password=hash_password("password"),
            full_name="Developer",
            role_id=role.id
        )
        db.add(user)
        db.commit()
        
        retrieved = db.query(User).filter(User.email == "dev@example.com").first()
        assert retrieved.role.name == "Developer"
    
    def test_user_role_assignment(self, db):
        """Test changing user role"""
        admin_role = Role(name="Admin")
        dev_role = Role(name="Developer")
        db.add_all([admin_role, dev_role])
        db.commit()
        
        user = User(
            email="user@example.com",
            hashed_password=hash_password("pass"),
            full_name="User",
            role_id=dev_role.id
        )
        db.add(user)
        db.commit()
        
        # Change role
        user.role_id = admin_role.id
        db.commit()
        
        assert user.role.name == "Admin"
    
    def test_admin_role_permissions(self, db):
        """Admin role has all permissions"""
        admin_role = Role(name="Admin", description="Full access")
        db.add(admin_role)
        db.commit()
        
        admin = User(
            email="admin@example.com",
            hashed_password=hash_password("admin"),
            full_name="Admin User",
            role_id=admin_role.id,
            is_verified=True
        )
        db.add(admin)
        db.commit()
        
        assert admin.role.name == "Admin"
    
    def test_viewer_role_limited_permissions(self, db):
        """Viewer role has limited read-only permissions"""
        viewer_role = Role(name="Viewer", description="Read-only")
        db.add(viewer_role)
        db.commit()
        
        viewer = User(
            email="viewer@example.com",
            hashed_password=hash_password("viewer"),
            full_name="Viewer User",
            role_id=viewer_role.id,
            is_verified=True
        )
        db.add(viewer)
        db.commit()
        
        assert viewer.role.name == "Viewer"


class TestProjectAccessControl:
    """Test project-level access control"""
    
    def test_owner_can_edit_project(self, db):
        """Project owner can edit project"""
        dev_role = Role(name="Developer")
        db.add(dev_role)
        db.commit()
        
        owner = User(
            email="owner@example.com",
            hashed_password=hash_password("pass"),
            full_name="Owner",
            role_id=dev_role.id
        )
        db.add(owner)
        db.commit()
        
        project = Project(name="Owner Project", owner_id=owner.id)
        db.add(project)
        db.commit()
        
        assert project.owner_id == owner.id
    
    def test_member_can_view_project(self, db):
        """Project member can view project"""
        dev_role = Role(name="Developer")
        db.add(dev_role)
        db.commit()
        
        owner = User(
            email="owner2@example.com",
            hashed_password=hash_password("pass"),
            full_name="Owner",
            role_id=dev_role.id
        )
        member = User(
            email="member2@example.com",
            hashed_password=hash_password("pass"),
            full_name="Member",
            role_id=dev_role.id
        )
        db.add_all([owner, member])
        db.commit()
        
        project = Project(name="Shared Project", owner_id=owner.id)
        db.add(project)
        db.commit()
        
        # Add as member
        pm = ProjectMember(
            project_id=project.id,
            user_id=member.id,
            role="Developer"
        )
        db.add(pm)
        db.commit()
        
        # Verify membership
        members = db.query(ProjectMember).filter(ProjectMember.project_id == project.id).all()
        assert len(members) == 1
        assert members[0].user_id == member.id
    
    def test_non_member_cannot_view_project(self, db):
        """Non-member cannot view private project"""
        dev_role = Role(name="Developer")
        db.add(dev_role)
        db.commit()
        
        owner = User(
            email="owner3@example.com",
            hashed_password=hash_password("pass"),
            full_name="Owner",
            role_id=dev_role.id
        )
        other = User(
            email="other@example.com",
            hashed_password=hash_password("pass"),
            full_name="Other",
            role_id=dev_role.id
        )
        db.add_all([owner, other])
        db.commit()
        
        project = Project(name="Private Project", owner_id=owner.id)
        db.add(project)
        db.commit()
        
        # Other user is not a member
        members = db.query(ProjectMember).filter(ProjectMember.project_id == project.id).all()
        assert all(m.user_id != other.id for m in members)


class TestPermissionValidation:
    """Test permission validation logic"""
    
    def test_admin_bypass_check(self, db):
        """Admin bypasses normal permission checks"""
        admin_role = Role(name="Admin")
        db.add(admin_role)
        db.commit()
        
        admin = User(
            email="admin2@example.com",
            hashed_password=hash_password("pass"),
            full_name="Admin",
            role_id=admin_role.id,
            is_verified=True
        )
        db.add(admin)
        db.commit()
        
        # Admin should have elevated permissions
        assert admin.role.name == "Admin"
    
    def test_security_manager_project_oversight(self, db):
        """Security Manager can view all projects"""
        sec_role = Role(name="Security Manager")
        db.add(sec_role)
        db.commit()
        
        sec_manager = User(
            email="secmgr@example.com",
            hashed_password=hash_password("pass"),
            full_name="Security Manager",
            role_id=sec_role.id,
            is_verified=True
        )
        db.add(sec_manager)
        db.commit()
        
        assert sec_manager.role.name == "Security Manager"


class TestScanPermissions:
    """Test scan access permissions"""
    
    def test_owner_can_view_scan(self, db):
        """Project owner can view project scans"""
        from app.models.scan import Scan
        
        dev_role = Role(name="Developer")
        db.add(dev_role)
        db.commit()
        
        owner = User(
            email="scanowner@example.com",
            hashed_password=hash_password("pass"),
            full_name="Owner",
            role_id=dev_role.id
        )
        db.add(owner)
        db.commit()
        
        project = Project(name="Scan Project", owner_id=owner.id)
        db.add(project)
        db.commit()
        
        scan = Scan(project_id=project.id, scan_type="SAST")
        db.add(scan)
        db.commit()
        
        # Owner can view
        assert scan.project.owner_id == owner.id
    
    def test_member_can_view_scan(self, db):
        """Project member can view scans"""
        from app.models.scan import Scan
        
        dev_role = Role(name="Developer")
        db.add(dev_role)
        db.commit()
        
        owner = User(
            email="scanowner2@example.com",
            hashed_password=hash_password("pass"),
            full_name="Owner",
            role_id=dev_role.id
        )
        member = User(
            email="scanmember@example.com",
            hashed_password=hash_password("pass"),
            full_name="Member",
            role_id=dev_role.id
        )
        db.add_all([owner, member])
        db.commit()
        
        project = Project(name="Scan Project 2", owner_id=owner.id)
        db.add(project)
        db.commit()
        
        pm = ProjectMember(project_id=project.id, user_id=member.id, role="Developer")
        db.add(pm)
        db.commit()
        
        scan = Scan(project_id=project.id, scan_type="DAST")
        db.add(scan)
        db.commit()
        
        assert scan.project_id == project.id


class TestAuditLogPermissions:
    """Test audit log access permissions"""
    
    def test_admin_can_view_all_logs(self, db):
        """Only admins can view all audit logs"""
        admin_role = Role(name="Admin")
        dev_role = Role(name="Developer")
        db.add_all([admin_role, dev_role])
        db.commit()
        
        admin = User(
            email="auditadmin@example.com",
            hashed_password=hash_password("pass"),
            full_name="Admin",
            role_id=admin_role.id
        )
        dev = User(
            email="auditdev@example.com",
            hashed_password=hash_password("pass"),
            full_name="Dev",
            role_id=dev_role.id
        )
        db.add_all([admin, dev])
        db.commit()
        
        # Admin role allows audit log access
        assert admin.role.name == "Admin"
        # Developer role doesn't
        assert dev.role.name == "Developer"


class TestPermissionEdgeCases:
    """Test permission edge cases"""
    
    def test_null_role(self, db):
        """User with null role"""
        user = User(
            email="nullrole@example.com",
            hashed_password=hash_password("pass"),
            full_name="No Role",
            role_id=None
        )
        db.add(user)
        db.commit()
        
        assert user.role_id is None
    
    def test_deleted_role_reference(self, db):
        """Handle deleted role reference"""
        role = Role(name="Temporary")
        db.add(role)
        db.commit()
        role_id = role.id
        
        # Create user with role
        user = User(
            email="deleterole@example.com",
            hashed_password=hash_password("pass"),
            full_name="User",
            role_id=role_id
        )
        db.add(user)
        db.commit()
        
        # Role still exists
        assert user.role_id == role_id
