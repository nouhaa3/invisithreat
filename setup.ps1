# InvisiThreat Setup Script
# This script sets up the development environment

Write-Host "Setting up InvisiThreat development environment..." -ForegroundColor Cyan

# Check if Python 3.11 or 3.12 is installed
Write-Host "`nChecking Python version..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
Write-Host "Found: $pythonVersion" -ForegroundColor Green

if ($pythonVersion -notmatch "Python 3\.1[12]") {
    Write-Host "WARNING: Python 3.11 or 3.12 is recommended. Current version: $pythonVersion" -ForegroundColor Yellow
}

# Check if Docker is installed
Write-Host "`nChecking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "Found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Create .env files if they don't exist
Write-Host "`nSetting up environment files..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env file" -ForegroundColor Green
} else {
    Write-Host ".env file already exists" -ForegroundColor Green
}

if (-not (Test-Path "backend\.env")) {
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "Created backend/.env file" -ForegroundColor Green
} else {
    Write-Host "backend/.env file already exists" -ForegroundColor Green
}

# Ask user if they want to set up virtual environment
Write-Host "`nDo you want to set up a local Python virtual environment? (y/n)" -ForegroundColor Yellow
Write-Host "   (This is optional - you can use Docker only)" -ForegroundColor Gray
$setupVenv = Read-Host

if ($setupVenv -eq "y" -or $setupVenv -eq "Y") {
    Write-Host "`nSetting up Python virtual environment..." -ForegroundColor Yellow
    
    Set-Location backend
    
    if (-not (Test-Path "venv")) {
        python -m venv venv
        Write-Host "Virtual environment created" -ForegroundColor Green
    }
    
    Write-Host "`nActivating virtual environment..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
    
    Write-Host "`nInstalling Python dependencies..." -ForegroundColor Yellow
    pip install --upgrade pip
    pip install -r requirements.txt
    Write-Host "Dependencies installed" -ForegroundColor Green
    
    Set-Location ..
    
    Write-Host "`nVirtual environment setup complete!" -ForegroundColor Green
    Write-Host "   To activate it later, run: backend\venv\Scripts\Activate.ps1" -ForegroundColor Gray
}

# Ask user if they want to start Docker containers
Write-Host "`nDo you want to start the Docker containers now? (y/n)" -ForegroundColor Yellow
$startDocker = Read-Host

if ($startDocker -eq "y" -or $startDocker -eq "Y") {
    Write-Host "`nBuilding and starting Docker containers..." -ForegroundColor Yellow
    docker-compose up --build -d
    
    Write-Host "`nDocker containers are starting!" -ForegroundColor Green
    Write-Host "   Backend API: http://localhost:8000" -ForegroundColor Cyan
    Write-Host "   API Docs: http://localhost:8000/api/docs" -ForegroundColor Cyan
    Write-Host "   Health Check: http://localhost:8000/api/health" -ForegroundColor Cyan
    Write-Host "`n   View logs: docker-compose logs -f" -ForegroundColor Gray
}

Write-Host "`nSetup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Review and update .env files with your configuration" -ForegroundColor White
Write-Host "  2. Start development: docker-compose up" -ForegroundColor White
Write-Host "  3. Access API docs: http://localhost:8000/api/docs" -ForegroundColor White
Write-Host "  4. Read README.md for more information" -ForegroundColor White
