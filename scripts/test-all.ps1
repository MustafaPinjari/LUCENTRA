<#
.SYNOPSIS
    LUCENTRA Full Test Suite Orchestrator
.DESCRIPTION
    Executes automated tests across all monorepo subsystems (Core, Contracts, Backend,
    Dashboard, Extension) and validates documentation structure.
#>

$ErrorActionPreference = "Continue"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Full Test Suite Orchestrator                       " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$npmCmd = if (Get-Command "npm.cmd" -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }
$Failures = 0
$ExecutedSuites = 0

# 1. Structure and Documentation Validation
Write-Host "[1/6] Validating Repository and Documentation Integrity..." -ForegroundColor Yellow
& powershell -ExecutionPolicy Bypass -File "$PSScriptRoot/validate-structure.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Structure validation FAILED!" -ForegroundColor Red
    $Failures++
} else {
    $ExecutedSuites++
}

# 2. Cryptographic Core Engine (@lucentra/core)
Write-Host "`n[2/6] Testing Cryptographic Core Engine (@lucentra/core)..." -ForegroundColor Yellow
if (Test-Path "packages/core/package.json") {
    Push-Location "packages/core"
    & $npmCmd test
    if ($LASTEXITCODE -ne 0) { $Failures++ }
    $ExecutedSuites++
    Pop-Location
} else {
    Write-Host "Skipping core engine test (packages/core not found)." -ForegroundColor DarkGray
}

# 3. Smart Contracts (Foundry)
Write-Host "`n[3/6] Testing Smart Contracts (Foundry)..." -ForegroundColor Yellow
$forgeCmd = Get-Command "forge" -ErrorAction SilentlyContinue
if ($forgeCmd -and (Test-Path "contracts/foundry.toml")) {
    Push-Location "contracts"
    & forge test -vvv
    if ($LASTEXITCODE -ne 0) { $Failures++ }
    $ExecutedSuites++
    Pop-Location
} else {
    Write-Host "Skipping contracts test (contracts/foundry.toml or forge not found)." -ForegroundColor DarkGray
}

# 4. Backend (pytest)
Write-Host "`n[4/6] Testing Backend Services (pytest)..." -ForegroundColor Yellow
$pyTestExe = "services/backend/.venv/Scripts/pytest.exe"
if (Test-Path $pyTestExe) {
    Push-Location "services/backend"
    & $pyTestExe
    if ($LASTEXITCODE -ne 0) { $Failures++ }
    $ExecutedSuites++
    Pop-Location
} else {
    Write-Host "Skipping backend test (pytest not found in services/backend/.venv)." -ForegroundColor DarkGray
}

# 5. Dashboard (Next.js / Vitest)
Write-Host "`n[5/6] Testing Dashboard..." -ForegroundColor Yellow
if (Test-Path "apps/dashboard/package.json") {
    Push-Location "apps/dashboard"
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    if ($pkg.scripts.test) {
        & $npmCmd test
        if ($LASTEXITCODE -ne 0) { $Failures++ }
        $ExecutedSuites++
    } else {
        Write-Host "No test script configured in apps/dashboard/package.json." -ForegroundColor DarkGray
    }
    Pop-Location
} else {
    Write-Host "Skipping dashboard test (apps/dashboard not initialized)." -ForegroundColor DarkGray
}

# 6. Extension
Write-Host "`n[6/6] Testing Extension..." -ForegroundColor Yellow
if (Test-Path "apps/extension/package.json") {
    Push-Location "apps/extension"
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    if ($pkg.scripts.test) {
        & $npmCmd test
        if ($LASTEXITCODE -ne 0) { $Failures++ }
        $ExecutedSuites++
    } else {
        Write-Host "No test script configured in apps/extension/package.json." -ForegroundColor DarkGray
    }
    Pop-Location
} else {
    Write-Host "Skipping extension test (apps/extension not initialized)." -ForegroundColor DarkGray
}

Write-Host "`n-----------------------------------------------------------------" -ForegroundColor Gray
if ($Failures -eq 0) {
    Write-Host "[SUCCESS] All executed test suites PASSED ($ExecutedSuites executed)!" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "[FAILURE] $Failures test suite(s) FAILED!" -ForegroundColor Red
    Write-Host "=================================================================" -ForegroundColor Cyan
    exit 1
}
