<#
.SYNOPSIS
    LUCENTRA Code Style and Linter Orchestration Script
.DESCRIPTION
    Runs linters, typechecks, and structural validation across the monorepo.
#>

$ErrorActionPreference = "Continue"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Monorepo Lint and Style Validation                   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$npmCmd = if (Get-Command "npm.cmd" -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }
$Failures = 0

# 1. Structural and Link Integrity
Write-Host "[1/4] Validating Documentation and Structure..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File "$PSScriptRoot/validate-structure.ps1"
if ($LASTEXITCODE -ne 0) { $Failures++ }

# 2. Core Engine Typecheck
Write-Host "`n[2/4] Typechecking Cryptographic Core Engine (@lucentra/core)..." -ForegroundColor Yellow
if (Test-Path "packages/core/package.json") {
    Push-Location "packages/core"
    & $npmCmd run typecheck
    if ($LASTEXITCODE -ne 0) { $Failures++ }
    Pop-Location
} else {
    Write-Host "Skipping core engine typecheck (packages/core not found)." -ForegroundColor DarkGray
}

# 3. Frontend / Extension Linting
Write-Host "`n[3/4] Checking Frontend and Extension Code Style..." -ForegroundColor Yellow
if (Test-Path "apps/dashboard/node_modules") {
    Push-Location "apps/dashboard"
    & $npmCmd run lint
    if ($LASTEXITCODE -ne 0) { $Failures++ }
    Pop-Location
} else {
    Write-Host "Skipping dashboard linting (apps/dashboard/node_modules not installed)." -ForegroundColor DarkGray
}

# 4. Python Linting
Write-Host "`n[4/4] Checking Backend Python Code Style..." -ForegroundColor Yellow
$flake8Exe = "services/backend/.venv/Scripts/flake8.exe"
if (Test-Path $flake8Exe) {
    Push-Location "services/backend"
    & $flake8Exe . --count --select=E9,F63,F7,F82 --show-source --statistics
    if ($LASTEXITCODE -ne 0) { $Failures++ }
    Pop-Location
} else {
    Write-Host "Skipping backend linting (flake8 not installed in services/backend/.venv)." -ForegroundColor DarkGray
}

Write-Host "`n-----------------------------------------------------------------" -ForegroundColor Gray
if ($Failures -eq 0) {
    Write-Host "[SUCCESS] Monorepo linting and style checks PASSED!" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "[FAILURE] Linting checks failed with $Failures error(s)!" -ForegroundColor Red
    Write-Host "=================================================================" -ForegroundColor Cyan
    exit 1
}
