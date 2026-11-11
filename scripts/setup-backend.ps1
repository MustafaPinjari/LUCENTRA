<#
.SYNOPSIS
    Sets up the LUCENTRA Django backend service.
.DESCRIPTION
    Installs Python dependencies, ensures local configuration, and runs SQLite migrations.
#>

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path "$PSScriptRoot/..").Path
$backendDir = Join-Path $workspaceRoot "services/backend"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Setup Django Backend                              " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Check Python
$pythonCmd = (Get-Command "python" -ErrorAction SilentlyContinue).Source
if (-not $pythonCmd) {
    Write-Error "Python executable not found in PATH."
    exit 1
}
Write-Host "Python: $pythonCmd"

# 2. Install dependencies
Write-Host "[1/3] Installing backend dependencies from requirements.txt..." -ForegroundColor Yellow
& python -m pip install -r (Join-Path $backendDir "requirements.txt") --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install Python dependencies."
    exit 1
}

# 3. Initialize local .env if missing
$envFile = Join-Path $backendDir ".env"
$envExample = Join-Path $backendDir ".env.example"
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Write-Host "[2/3] Initializing services/backend/.env from .env.example..." -ForegroundColor Yellow
    Copy-Item $envExample $envFile
}

# 4. Run migrations
Write-Host "[3/3] Applying SQLite database migrations..." -ForegroundColor Yellow
& python (Join-Path $backendDir "manage.py") migrate
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to apply database migrations."
    exit 1
}

$dbFile = Join-Path $backendDir "db.sqlite3"
if (Test-Path $dbFile) {
    Write-Host "[OK] SQLite database initialized at $dbFile." -ForegroundColor Green
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   Backend Setup Complete!                                      " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
exit 0
