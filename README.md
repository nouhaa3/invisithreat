# InvisiThreat

InvisiThreat is an intelligent DevSecOps platform for automated vulnerability detection.

## Tech Stack
- Backend: FastAPI (Python 3.12)
- Frontend: React + Tailwind
- Database: PostgreSQL
- DevSecOps: Docker, GitHub Actions
- Security: SAST, DAST, LLM

## Project Structure

```
invisithreat/
│
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI application entry point
│   │   ├── api/               # API routes and endpoints
│   │   │   ├── __init__.py
│   │   │   ├── router.py      # Main API router
│   │   │   └── health.py      # Health check endpoints
│   │   ├── core/              # Core functionality
│   │   │   ├── __init__.py
│   │   │   └── config.py      # Configuration settings
│   │   ├── db/                # Database configuration
│   │   │   ├── __init__.py
│   │   │   ├── base.py        # SQLAlchemy Base
│   │   │   └── session.py     # Database session
│   │   ├── models/            # SQLAlchemy models
│   │   │   └── __init__.py
│   │   ├── schemas/           # Pydantic schemas
│   │   │   └── __init__.py
│   │   └── services/          # Business logic
│   │       └── __init__.py
│   ├── tests/                 # Backend tests
│   ├── venv/                  # Python virtual environment (not versioned)
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile            # Backend Docker configuration
│   └── .dockerignore         # Docker ignore rules
│
├── frontend/                  # React Frontend (to be implemented)
│
├── docs/                      # Documentation
│
├── infra/                     # Infrastructure configuration
│
├── scripts/                   # Utility scripts
│
├── docker-compose.yml         # Docker Compose orchestration
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── Makefile                  # Development commands (Linux/Mac)
├── setup.ps1                 # Setup script (Windows)
└── README.md                 # This file
```

## Getting Started

### Prerequisites

- Python 3.12
- Docker & Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd invisithreat
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file with your configuration if needed.

3. **Using Docker (Recommended)**
   
   Start all services with Docker Compose:
   ```bash
   docker-compose up --build
   ```
   
   The backend API will be available at:
   - API: http://localhost:8000
   - API Docs: http://localhost:8000/api/docs
   - Health Check: http://localhost:8000/api/health

4. **Local Development (Backend)**
   
   If you prefer to run the backend locally without Docker:
   
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   # On Windows:
   venv\Scripts\activate
   # On Linux/Mac:
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Run the application
   uvicorn app.main:app --reload
   ```

### Database

PostgreSQL 16 (Docker container):
- Host: localhost (or 'db' inside Docker network)
- Port: 5432
- Database: invisithreat_db
- User: invisithreat
- Password: invisithreat_password (change in production!)

## Development

### API Documentation

Once the backend is running, access the interactive API documentation:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

### Running Tests

```bash
cd backend
pytest
```

### Code Quality

```bash
# Format code
black app/

# Lint code
flake8 app/

# Type checking
mypy app/
```

## Docker Commands

```bash
# Build and start services
docker-compose up --build

# Start services in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild specific service
docker-compose build backend

# Access backend shell
docker-compose exec backend bash
```

## Project Status

[DONE] Backend structure and FastAPI setup  
[DONE] Docker and Docker Compose configuration  
[DONE] PostgreSQL integration  
[DONE] Environment configuration  
[TODO] Frontend development (React + Tailwind)  
[TODO] Authentication & Authorization  
[TODO] Security scanning features  
[TODO] CI/CD pipeline  

## Security Note

This project is for academic purposes.
Default credentials must be changed before production deployment.
Secrets are managed via environment variables.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

[Your License Here]

## Contact

[Your Contact Information]
