<#
.SYNOPSIS
    LUCENTRA Backend Subsystem Scaffolding Script
.DESCRIPTION
    Initializes the Python virtual environment and dependencies for services/backend/.
#>

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Backend Subsystem Initialization (Django/Python)   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$BackendDir = Join-Path $PSScriptRoot "..\services\backend"

if (-not (Test-Path $BackendDir)) {
    New-Item -ItemType Directory -Path $BackendDir -Force | Out-Null
}

Set-Location $BackendDir

# Create requirements.txt if not present
if (-not (Test-Path "requirements.txt")) {
    $reqs = @"
# Core Framework and API
Django>=5.0,<5.2
djangorestframework>=3.15.0
django-cors-headers>=4.3.1
django-environ>=0.11.2

# Database and Cache
psycopg2-binary>=2.9.9
redis>=5.0.3

# Asynchronous Tasks
celery>=5.3.6

# Web3 and Cryptography
web3>=6.15.1
eth-account>=0.11.0
pycryptodome>=3.20.0
idna>=3.6
dnspython>=2.6.1
requests>=2.31.0

# Testing and Quality
pytest>=8.1.1
pytest-django>=4.8.0
black>=24.3.0
flake8>=7.0.0
"@
    Set-Content -Path "requirements.txt" -Value $reqs
    Write-Host "Created services/backend/requirements.txt" -ForegroundColor Green
}

# Create Python Virtual Environment
$VenvPath = Join-Path $BackendDir ".venv"
if (-not (Test-Path $VenvPath)) {
    Write-Host "Creating Python virtual environment in services/backend/.venv..." -ForegroundColor Yellow
    and python -m venv .venv
    Write-Host "Virtual environment created!" -ForegroundColor Green
} else {
    Write-Host "Virtual environment services/backend/.venv already exists." -ForegroundColor Gray
}

$pipExe = Join-Path $VenvPath "Scripts\pip.exe"
if (Test-Path $pipExe) {
    Write-Host "Virtual environment pip found at $pipExe" -ForegroundColor Green
    Write-Host "To install dependencies into the backend virtualenv, run:" -ForegroundColor Cyan
    Write-Host "  and `"$pipExe`" install -r requirements.txt" -ForegroundColor White
}

Set-Location $PSScriptRoot\..
Write-Host "[SUCCESS] Backend subsystem initialization complete!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
