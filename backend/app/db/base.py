from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models here for SQLAlchemy to register them
from app.models import role, user  # noqa: F401