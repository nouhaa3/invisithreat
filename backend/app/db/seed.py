"""
Seed script - Creates default roles and users.
Run: python -m app.db.seed
"""
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.db.session import SessionLocal
from app.models.role import Role
from app.models.user import User
from app.core.security import hash_password
import uuid

ROLES = [
    {"name": "Admin",            "description": "Full access to all features"},
    {"name": "Developer",        "description": "Access to development tools and pipelines"},
    {"name": "Security Manager", "description": "Access to security scans and reports"},
    {"name": "Viewer",           "description": "Read-only access"},
]

USERS = [
    {"nom": "Test User",        "email": "testuser@invisithreat.dev",  "password": "SecurePass@2024", "role": "Developer"},
    {"nom": "Security Manager", "email": "security@invisithreat.dev",  "password": "SecurePass@2024", "role": "Security Manager"},
    {"nom": "Admin",            "email": "admin@invisithreat.dev",     "password": "SecurePass@2024", "role": "Admin"},
    {"nom": "Viewer",           "email": "viewer@invisithreat.dev",    "password": "SecurePass@2024", "role": "Viewer"},
]

def seed():
    db = SessionLocal()
    try:
        print("Seeding roles...")
        role_map = {}
        for r in ROLES:
            obj = db.query(Role).filter(Role.name == r["name"]).first()
            if not obj:
                obj = Role(id=uuid.uuid4(), name=r["name"], description=r["description"])
                db.add(obj)
                db.flush()
                print(f"  + Role: {r['name']}")
            else:
                print(f"  = Role exists: {r['name']}")
            role_map[r["name"]] = obj
        db.commit()

        print("\nSeeding users...")
        for u in USERS:
            obj = db.query(User).filter(User.email == u["email"]).first()
            if not obj:
                obj = User(
                    id=uuid.uuid4(),
                    nom=u["nom"],
                    email=u["email"],
                    hashed_password=hash_password(u["password"]),
                    role_id=role_map[u["role"]].id,
                    is_active=True,
                )
                db.add(obj)
                print(f"  + User: {u['email']}")
            else:
                print(f"  = User exists: {u['email']}")
        db.commit()
        print("\nSeed complete!")
    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
