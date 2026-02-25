"""
Base class for SQLAlchemy models
Import all models here to ensure they are registered with SQLAlchemy
"""
from sqlalchemy.ext.declarative import declarative_base

# Create Base class for models
Base = declarative_base()

# Import all models here for Alembic migrations
# Example:
# from app.models.user import User
# from app.models.scan import Scan