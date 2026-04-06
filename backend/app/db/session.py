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
}

# Check if using SQLite (for testing) and enable check_same_thread=False
db_url = settings.DATABASE_URL
if "sqlite" in db_url:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

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