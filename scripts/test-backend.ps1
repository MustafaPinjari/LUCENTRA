<#
.SYNOPSIS
    Runs the Django backend test suite for LUCENTRA.
.DESCRIPTION
    Executes all unit, integration, and live Anvil tests with SQLite and subprocess CLI bridge.
#>

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path "$PSScriptRoot/..").Path
$backendDir = Join-Path $workspaceRoot "services/backend"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Django Backend Test Suite                         " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

Set-Location $backendDir
& python manage.py test tests
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend test suite failed."
    exit 1
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   All Backend Tests Passed!                                     " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
exit 0
