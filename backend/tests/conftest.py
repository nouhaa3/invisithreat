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
required_vars = ["APP_NAME", "DATABASE_URL", "SECRET_KEY"]
missing = [v for v in required_vars if not os.environ.get(v)]
if missing:
    print(f"[WARN] Missing environment variables: {missing}")
else:
    print("[OK] All required environment variables loaded")


def pytest_configure(config):
    """
    Load environment variables before pytest collection.
    This runs before any test modules are collected.
    """
    # Ensure .env is loaded before pytest does collection
    if env_path.exists():
        load_dotenv(str(env_path), override=True)
    
    # Set defaults for any missing critical vars
    if not os.environ.get("APP_NAME"):
        os.environ["APP_NAME"] = "invisithreat"
    if not os.environ.get("DATABASE_URL"):
        os.environ["DATABASE_URL"] = "postgresql://localhost/invisithreat_test"
    if not os.environ.get("SECRET_KEY"):
        os.environ["SECRET_KEY"] = "test-secret-key-do-not-use-in-production"
