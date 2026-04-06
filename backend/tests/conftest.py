import sys
import os
from pathlib import Path

# Load environment variables from .env FIRST before any imports
from dotenv import load_dotenv

# Get backend directory
backend_dir = Path(__file__).parent.parent
env_path = backend_dir / ".env"

# Load .env file
if env_path.exists():
    load_dotenv(str(env_path), override=True)
    print(f"[OK] Loaded .env from: {env_path}")
else:
    print(f"[WARN] .env file not found at: {env_path}")

# Add backend to path
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Verify required env vars are loaded
required_vars = ["APP_NAME", "SECRET_KEY"]
missing = [v for v in required_vars if not os.environ.get(v)]
if missing:
    print(f"[WARN] Missing environment variables: {missing}")
else:
    print(f"[OK] All required environment variables loaded")


def pytest_configure(config):
    """
    Load environment variables before pytest collection.
    This runs before any test modules are collected.
    """
    # Ensure .env is loaded before pytest does collection
    if env_path.exists():
        load_dotenv(str(env_path), override=True)
    
    # Override DATABASE_URL for testing FIRST, before any app imports
    os.environ["DATABASE_URL"] = "sqlite:///:memory:?check_same_thread=false"
    
    # Set defaults for any missing critical vars
    if not os.environ.get("APP_NAME"):
        os.environ["APP_NAME"] = "invisithreat"
    if not os.environ.get("SECRET_KEY"):
        os.environ["SECRET_KEY"] = "test-secret-key-do-not-use-in-production"
    
    print(f"[OK] Test environment configured with DATABASE_URL: {os.environ.get('DATABASE_URL')}")
    
    # Create a single test database engine BEFORE loading app modules
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    
    # Create in-memory engine with a StaticPool so connections share the same database
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # CRITICAL: Ensures all connections share the same in-memory DB
    )
    
    # Import and setup models BEFORE the engine is used
    from app.db.base import Base, import_models
    import_models()
    
    # Create all tables
    Base.metadata.create_all(bind=test_engine)
    print("[OK] Test database tables created")
    
    # NOW inject the test engine into app.db.session BEFORE anything else imports it
    import app.db.session
    app.db.session.engine = test_engine
    app.db.session.SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine
    )
    print("[OK] Test engine injected into app.db.session")
