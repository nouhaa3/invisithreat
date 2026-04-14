"""
Database session configuration
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from app.core.config import settings


def _env_int(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
        return value if value >= 0 else default
    except ValueError:
        return default


def _is_managed_pooler_url(url_value: str) -> bool:
    lowered = (url_value or "").lower()
    return "pooler.supabase.com" in lowered or "pgbouncer" in lowered

# Create SQLAlchemy engine
# For SQLite in-memory testing, allow cross-thread access
DATABASE_URL_VALUE = settings.DATABASE_URL

default_pool_size = 5
default_max_overflow = 5
if _is_managed_pooler_url(DATABASE_URL_VALUE):
    # Keep the app-side pool intentionally small behind managed DB poolers.
    default_pool_size = 2
    default_max_overflow = 1

db_use_null_pool_raw = (os.getenv("DB_USE_NULL_POOL") or "").strip().lower()
if db_use_null_pool_raw:
    use_null_pool = db_use_null_pool_raw in {"1", "true", "yes", "on"}
else:
    # Safe default for managed poolers: don't keep idle app-level pooled sessions.
    use_null_pool = _is_managed_pooler_url(DATABASE_URL_VALUE)

engine_kwargs = {
    "pool_pre_ping": True,
    "echo": False,  # Set to True for SQL query logging
    "pool_recycle": _env_int("DB_POOL_RECYCLE", 1800),
    "pool_timeout": _env_int("DB_POOL_TIMEOUT", 30),
}

if use_null_pool:
    engine_kwargs.pop("pool_timeout", None)
    engine_kwargs.pop("pool_recycle", None)
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_size"] = _env_int("DB_POOL_SIZE", default_pool_size)
    engine_kwargs["max_overflow"] = _env_int("DB_MAX_OVERFLOW", default_max_overflow)

# Check if using SQLite (for testing) and enable check_same_thread=False
if "sqlite" in DATABASE_URL_VALUE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    # SQLite doesn't need large pools
    engine_kwargs.pop("pool_size", None)
    engine_kwargs.pop("max_overflow", None)
    engine_kwargs.pop("pool_timeout", None)
    engine_kwargs.pop("pool_recycle", None)
    engine_kwargs.pop("poolclass", None)

engine = create_engine(DATABASE_URL_VALUE, **engine_kwargs)

# Create SessionLocal class
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency for getting database session
    Usage: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()