"""
Database session configuration
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from app.core.config import settings

# Create SQLAlchemy engine
# For SQLite in-memory testing, allow cross-thread access
engine_kwargs = {
    "pool_pre_ping": True,
    "echo": False,  # Set to True for SQL query logging
    "pool_size": 20,  # Connection pool size for production/high-concurrency
    "max_overflow": 40,  # Allow up to 40 connections beyond pool_size
}

# Check if using SQLite (for testing) and enable check_same_thread=False
db_url = settings.DATABASE_URL
if "sqlite" in db_url:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    # SQLite doesn't need large pools
    engine_kwargs.pop("pool_size", None)
    engine_kwargs.pop("max_overflow", None)

engine = create_engine(db_url, **engine_kwargs)

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