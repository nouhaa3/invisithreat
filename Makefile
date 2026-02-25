.PHONY: help setup up down build logs test clean venv install

help:
	@echo "InvisiThreat - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup      - Initial project setup"
	@echo "  make venv       - Create Python virtual environment"
	@echo "  make install    - Install Python dependencies"
	@echo ""
	@echo "Docker:"
	@echo "  make up         - Start all services"
	@echo "  make down       - Stop all services"
	@echo "  make build      - Build Docker images"
	@echo "  make logs       - View service logs"
	@echo "  make restart    - Restart all services"
	@echo ""
	@echo "Development:"
	@echo "  make test       - Run tests"
	@echo "  make lint       - Run linters"
	@echo "  make format     - Format code"
	@echo "  make clean      - Clean temporary files"

setup:
	@echo "Setting up InvisiThreat..."
	@cp -n .env.example .env || true
	@cp -n backend/.env.example backend/.env || true
	@echo "Environment files created. Edit .env files as needed."

venv:
	@echo "Creating virtual environment..."
	cd backend && python -m venv venv
	@echo "Virtual environment created. Activate with: source backend/venv/bin/activate"

install:
	@echo "Installing dependencies..."
	cd backend && pip install -r requirements.txt

up:
	@echo "Starting services..."
	docker-compose up -d
	@echo "Services started. API: http://localhost:8000/api/docs"

down:
	@echo "Stopping services..."
	docker-compose down

build:
	@echo "Building images..."
	docker-compose build

logs:
	docker-compose logs -f

restart:
	@echo "Restarting services..."
	docker-compose restart

test:
	@echo "Running tests..."
	cd backend && pytest

lint:
	@echo "Running linters..."
	cd backend && flake8 app/
	cd backend && mypy app/

format:
	@echo "Formatting code..."
	cd backend && black app/

clean:
	@echo "Cleaning temporary files..."
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	@echo "Clean complete."
