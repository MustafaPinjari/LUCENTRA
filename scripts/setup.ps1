<#
.SYNOPSIS
    LUCENTRA Monorepo Initialization and Setup Script
.DESCRIPTION
    Sets up the monorepo workspace directory tree, copies local environment templates,
    and runs diagnostic environment checks.
#>

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Monorepo Workspace Initialization                  " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Monorepo Subdirectories
$Subsystems = @(
    "apps/dashboard",
    "apps/extension",
    "services/backend",
    "services/witness",
    "contracts",
    "packages/core",
    "packages/cli"
)

Write-Host "[1/3] Ensuring Monorepo Directory Layout..." -ForegroundColor Yellow
foreach ($sub in $Subsystems) {
    if (-not (Test-Path $sub)) {
        New-Item -ItemType Directory -Path $sub -Force | Out-Null
        Write-Host "  [CREATED] $sub" -ForegroundColor Green
    } else {
        Write-Host "  [EXISTS]  $sub" -ForegroundColor Gray
    }
}

# 2. Environment Template Copying
Write-Host "`n[2/3] Setting up Local Environment Files..." -ForegroundColor Yellow
if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  [COPIED] .env created from .env.example" -ForegroundColor Green
} else {
    Write-Host "  [EXISTS] .env already present (skipped copy)" -ForegroundColor Gray
}

# 3. Run Environment Checks
Write-Host "`n[3/3] Running Environment Diagnostic Checks..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File "$PSScriptRoot/check-environment.ps1"

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "   Initialization Complete! Next Steps for Implementation:      " -ForegroundColor Cyan
Write-Host "   - contracts/        : Run ./scripts/init-contracts.ps1" -ForegroundColor Yellow
Write-Host "   - services/backend/ : Run ./scripts/init-backend.ps1" -ForegroundColor Yellow
Write-Host "   - apps/dashboard/   : Run ./scripts/init-dashboard.ps1" -ForegroundColor Yellow
Write-Host "   - apps/extension/   : Run ./scripts/init-extension.ps1" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan
