<#
.SYNOPSIS
    LUCENTRA Code Style & Linter Orchestration Script
.DESCRIPTION
    Runs linters, formatting checks, and structural validation across the monorepo.
#>

$ErrorActionPreference = "Continue"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA — Monorepo Lint & Style Validation                   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$npmCmd = if (Get-Command "npm.cmd" -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }
$Failures = 0

# 1. Structural & Link Integrity
Write-Host "[1/3] Validating Documentation & Structure..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File "$PSScriptRoot/validate-structure.ps1"
if ($LASTEXITCODE -ne 0) { $Failures++ }

# 2. Frontend / Extension Linting
Write-Host "`n[2/3] Checking Frontend & Extension Code Style..." -ForegroundColor Yellow
if (Test-Path "apps/dashboard/node_modules") {
    Push-Location "apps/dashboard"
    & $npmCmd run lint
    if ($LASTEXITCODE -ne 0) { $Failures++ }
    Pop-Location
} else {
    Write-Host "Skipping dashboard linting (apps/dashboard/node_modules not installed)." -ForegroundColor DarkGray
}

# 3. Python Linting
Write-Host "`n[3/3] Checking Backend Python Code Style..." -ForegroundColor Yellow
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
