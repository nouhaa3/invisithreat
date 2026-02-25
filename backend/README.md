# InvisiThreat Backend

FastAPI backend for the InvisiThreat DevSecOps platform.

## Structure

```
app/
├── api/          # API endpoints and routes
├── core/         # Core configuration (settings, security)
├── db/           # Database configuration (session, base)
├── models/       # SQLAlchemy ORM models
├── schemas/      # Pydantic schemas (request/response validation)
└── services/     # Business logic layer
```

## Key Modules

### `app/db/`
Database configuration and session management.

**session.py**: Database session factory
```python
from app.db import get_db, SessionLocal
from sqlalchemy.orm import Session
from fastapi import Depends

@app.get("/items")
def get_items(db: Session = Depends(get_db)):
    return db.query(Item).all()
```

**base.py**: SQLAlchemy Base class for all models

### `app/models/`
SQLAlchemy ORM models for database tables.

Example:
```python
from sqlalchemy import Column, Integer, String
from app.db.base import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True)
```

### `app/schemas/`
Pydantic schemas for request/response validation.

Example:
```python
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class User(BaseModel):
    id: int
    email: str
    username: str
    
    class Config:
        from_attributes = True
```

### `app/services/`
Business logic separated from routes.

Example:
```python
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate

class UserService:
    @staticmethod
    def create_user(db: Session, user: UserCreate) -> User:
        db_user = User(**user.dict())
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
```

## Development

### Setup
```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### Run
```bash
# Development server with auto-reload
uvicorn app.main:app --reload

# Or use the configured command
python -m app.main
```

### Testing
```bash
pytest tests/ -v
```

### Database Migrations (Alembic)
```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Environment Variables

Copy `.env.example` from the root directory and create `.env`:
```bash
cp ../.env.example .env
```

Key variables:
- `POSTGRES_HOST`: Use `db` for Docker, `localhost` for local dev
- `SECRET_KEY`: Generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- `DEBUG`: Set to `false` in production

## API Documentation

Once running, access:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc
- OpenAPI JSON: http://localhost:8000/api/openapi.json
