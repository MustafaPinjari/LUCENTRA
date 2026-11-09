<#
.SYNOPSIS
    LUCENTRA Local Development Environment Launcher
.DESCRIPTION
    Checks initialized services and launches local development instances.
#>

param (
    [string]$Service = "status" # options: status, backend, dashboard, extension, anvil, all
)

$ErrorActionPreference = "Continue"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Local Development Orchestrator                     " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$npmCmd = if (Get-Command "npm.cmd" -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }

function Show-Status {
    Write-Host "Subsystem Initialization Status:" -ForegroundColor Yellow
    
    # Contracts
    $hasContracts = Test-Path "contracts/foundry.toml"
    Write-Host -NoNewline "  contracts/        : "
    if ($hasContracts) { Write-Host "READY" -ForegroundColor Green } else { Write-Host "NOT INITIALIZED (run ./scripts/init-contracts.ps1)" -ForegroundColor DarkGray }

    # Backend
    $hasBackend = Test-Path "services/backend/.venv"
    Write-Host -NoNewline "  services/backend/ : "
    if ($hasBackend) { Write-Host "READY" -ForegroundColor Green } else { Write-Host "NOT INITIALIZED (run ./scripts/init-backend.ps1)" -ForegroundColor DarkGray }

    # Dashboard
    $hasDash = Test-Path "apps/dashboard/package.json"
    Write-Host -NoNewline "  apps/dashboard/   : "
    if ($hasDash) { Write-Host "READY" -ForegroundColor Green } else { Write-Host "NOT INITIALIZED (run ./scripts/init-dashboard.ps1)" -ForegroundColor DarkGray }

    # Extension
    $hasExt = Test-Path "apps/extension/package.json"
    Write-Host -NoNewline "  apps/extension/   : "
    if ($hasExt) { Write-Host "READY" -ForegroundColor Green } else { Write-Host "NOT INITIALIZED (run ./scripts/init-extension.ps1)" -ForegroundColor DarkGray }

    Write-Host ""
    Write-Host "Usage Examples:" -ForegroundColor Cyan
    Write-Host "  ./scripts/dev.ps1 -Service dashboard   # Start Next.js dashboard" -ForegroundColor White
    Write-Host "  ./scripts/dev.ps1 -Service backend     # Start Django backend" -ForegroundColor White
    Write-Host "  ./scripts/dev.ps1 -Service extension   # Start Vite build watcher" -ForegroundColor White
    Write-Host "  ./scripts/dev.ps1 -Service anvil       # Start local Foundry Anvil node" -ForegroundColor White
}

switch ($Service.ToLower()) {
    "dashboard" {
        if (-not (Test-Path "apps/dashboard/package.json")) {
            Write-Host "apps/dashboard is not yet initialized. Run ./scripts/init-dashboard.ps1" -ForegroundColor Red
            exit 1
        }
        Write-Host "Starting Next.js dashboard on http://localhost:3000..." -ForegroundColor Green
        Set-Location "apps/dashboard"
        and $npmCmd run dev
    }
    "backend" {
        $pyExe = "services/backend/.venv/Scripts/python.exe"
        if (-not (Test-Path $pyExe)) {
            Write-Host "services/backend/.venv is not yet initialized. Run ./scripts/init-backend.ps1" -ForegroundColor Red
            exit 1
        }
        Write-Host "Starting Django server on http://localhost:8000..." -ForegroundColor Green
        Set-Location "services/backend"
        and $pyExe manage.py runserver 0.0.0.0:8000
    }
    "extension" {
        if (-not (Test-Path "apps/extension/package.json")) {
            Write-Host "apps/extension is not yet initialized. Run ./scripts/init-extension.ps1" -ForegroundColor Red
            exit 1
        }
        Write-Host "Starting Extension Vite watcher..." -ForegroundColor Green
        Set-Location "apps/extension"
        and $npmCmd run watch
    }
    "anvil" {
        $anvilCmd = Get-Command "anvil" -ErrorAction SilentlyContinue
        if (-not $anvilCmd) {
            Write-Host "Foundry anvil is not installed or not in PATH." -ForegroundColor Red
            exit 1
        }
        Write-Host "Starting local Ethereum Anvil testnode on http://127.0.0.1:8545..." -ForegroundColor Green
        and anvil --chain-id 31337
    }
    default {
        Show-Status
    }
}
