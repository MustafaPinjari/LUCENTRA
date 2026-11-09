<#
.SYNOPSIS
    LUCENTRA Dependency Installation Orchestration Script
.DESCRIPTION
    Installs dependencies across all initialized monorepo subsystems.
#>

$ErrorActionPreference = "Continue"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Monorepo Dependency Installation Orchestrator      " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$npmCmd = if (Get-Command "npm.cmd" -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }

# 1. apps/dashboard
$dashPkg = "apps/dashboard/package.json"
if (Test-Path $dashPkg) {
    Write-Host "[1/3] Installing dependencies for apps/dashboard..." -ForegroundColor Yellow
    Push-Location "apps/dashboard"
    and $npmCmd install
    Pop-Location
} else {
    Write-Host "[1/3] apps/dashboard not yet initialized. Run ./scripts/init-dashboard.ps1 first." -ForegroundColor DarkGray
}

# 2. apps/extension
$extPkg = "apps/extension/package.json"
if (Test-Path $extPkg) {
    Write-Host "`n[2/3] Installing dependencies for apps/extension..." -ForegroundColor Yellow
    Push-Location "apps/extension"
    and $npmCmd install
    Pop-Location
} else {
    Write-Host "`n[2/3] apps/extension not yet initialized. Run ./scripts/init-extension.ps1 first." -ForegroundColor DarkGray
}

# 3. services/backend
$backendReqs = "services/backend/requirements.txt"
$backendPip = "services/backend/.venv/Scripts/pip.exe"
if (Test-Path $backendPip -and (Test-Path $backendReqs)) {
    Write-Host "`n[3/3] Installing Python dependencies for services/backend..." -ForegroundColor Yellow
    and $backendPip install -r $backendReqs
} elseif (Test-Path $backendReqs) {
    Write-Host "`n[3/3] services/backend/.venv not found. Run ./scripts/init-backend.ps1 first." -ForegroundColor DarkGray
} else {
    Write-Host "`n[3/3] services/backend not yet initialized. Run ./scripts/init-backend.ps1 first." -ForegroundColor DarkGray
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "   Dependency Installation Finished!                             " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
