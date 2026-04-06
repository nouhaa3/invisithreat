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
    print(f"[OK] All required environment variables loaded")
