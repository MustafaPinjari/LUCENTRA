<#
.SYNOPSIS
    LUCENTRA End-to-End Local Deployment Integration Test Runner
.DESCRIPTION
    Verifies that the local Anvil blockchain is running and deployed, verifies deployment
    contracts and schema on-chain, and executes the comprehensive 20-step lifecycle and
    13 negative security scenarios against live contracts.
#>

[CmdletBinding()]
param(
    [string]$RpcUrl = "http://127.0.0.1:8545"
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Local Blockchain End-to-End Test Suite            " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "RPC Endpoint: $RpcUrl"
Write-Host ""

$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$npmCmd = if (Get-Command "npm.cmd" -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }

# 1. Check if local chain is active
Write-Host "[1/4] Verifying local Anvil connectivity..." -ForegroundColor Yellow
$castCmd = Get-Command "cast" -ErrorAction SilentlyContinue
if (-not $castCmd -and (Test-Path "$repoRoot/.bin/cast.exe")) {
    $castCmd = (Resolve-Path "$repoRoot/.bin/cast.exe").Path
}

$chainId = $null
if ($castCmd) {
    try {
        $chainId = & $castCmd chain-id --rpc-url $RpcUrl 2>$null
    } catch {}
}

if (-not $chainId -or $chainId.Trim() -ne "31337") {
    Write-Host "ERROR: Local chain at $RpcUrl is not running or chainId is not 31337!" -ForegroundColor Red
    Write-Host "Please start the local chain first using:" -ForegroundColor Yellow
    Write-Host "  .\\scripts\\local-chain.ps1"
    exit 1
}
Write-Host "Connected to local Anvil node (Chain ID: 31337)" -ForegroundColor Green

# 2. Run deployment verification
Write-Host "`n[2/4] Verifying smart contract deployments on-chain..." -ForegroundColor Yellow
$verifyScript = Join-Path $PSScriptRoot "verify-local-deployment.ps1"
& powershell -ExecutionPolicy Bypass -File $verifyScript -RpcUrl $RpcUrl
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment verification failed!" -ForegroundColor Red
    exit 1
}

# 3. Build @lucentra/core
Write-Host "`n[3/4] Building @lucentra/core TypeScript packages..." -ForegroundColor Yellow
Push-Location (Join-Path $repoRoot "packages/core")
try {
    & $npmCmd run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Core build failed!" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
Write-Host "@lucentra/core built successfully." -ForegroundColor Green

# 4. Execute End-to-End test suite
Write-Host "`n[4/4] Executing Phase 4 (20 Lifecycle Steps) & Phase 5 (13 Negative Scenarios)..." -ForegroundColor Yellow
Push-Location (Join-Path $repoRoot "packages/core")
try {
    & node --test dist/test/e2e.test.js
    $testExit = $LASTEXITCODE
    if ($testExit -ne 0) {
        Write-Host "`nEnd-to-end integration tests FAILED!" -ForegroundColor Red
        exit $testExit
    }
} finally {
    Pop-Location
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "   END-TO-END INTEGRATION TEST SUITE PASSED (100%)                " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "All 20 positive lifecycle steps and 13 negative security scenarios verified on-chain."
exit 0
