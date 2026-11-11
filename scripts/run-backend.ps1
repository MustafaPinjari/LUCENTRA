<#
.SYNOPSIS
    Starts the LUCENTRA Django backend service.
.DESCRIPTION
    Launches the Django development server on 127.0.0.1:8000.
    Checks that local Anvil blockchain is running first.
#>

param(
    [string]$HostAddress = "127.0.0.1",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path "$PSScriptRoot/..").Path
$backendDir = Join-Path $workspaceRoot "services/backend"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Run Django Backend                                " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Verify Anvil local blockchain connection
$anvilPort = 8545
$conn = Get-NetTCPConnection -LocalPort $anvilPort -State Listen -ErrorAction SilentlyContinue
if (-not $conn) {
    Write-Host "[WARNING] Local Anvil blockchain is not listening on port $anvilPort." -ForegroundColor Yellow
    Write-Host "Starting local Anvil blockchain..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File "$PSScriptRoot/local-chain.ps1"
} else {
    Write-Host "[OK] Local Anvil blockchain is listening on port $anvilPort." -ForegroundColor Green
}

# 2. Start server
Write-Host "Starting Django REST Framework server at http://${HostAddress}:${Port}..." -ForegroundColor Green
Set-Location $backendDir
& python manage.py runserver "${HostAddress}:${Port}"
