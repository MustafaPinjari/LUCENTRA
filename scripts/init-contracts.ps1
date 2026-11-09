<#
.SYNOPSIS
    LUCENTRA Smart Contracts Scaffolding Script
.DESCRIPTION
    Initializes the Foundry environment for Solidity smart contract development
    under contracts/.
#>

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA — Contracts Subsystem Initialization (Foundry)       " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$ContractsDir = Join-Path $PSScriptRoot "..\contracts"

if (-not (Test-Path $ContractsDir)) {
    New-Item -ItemType Directory -Path $ContractsDir -Force | Out-Null
}

Set-Location $ContractsDir

$forgeCmd = Get-Command "forge" -ErrorAction SilentlyContinue

if (-not $forgeCmd) {
    Write-Host "[WARNING] 'forge' (Foundry) was not found in PATH." -ForegroundColor Yellow
    Write-Host "To install Foundry on Windows:" -ForegroundColor Cyan
    Write-Host "  powershell -c `"irm https://foundry.paradigm.xyz | iex`"" -ForegroundColor White
    Write-Host "  foundryup" -ForegroundColor White
    Write-Host ""
    Write-Host "Creating standard Foundry folder structure manually..." -ForegroundColor Yellow
    @("src", "test", "script") | ForEach-Object {
        if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
    }
} else {
    if (-not (Test-Path "foundry.toml")) {
        Write-Host "Initializing Foundry project with forge init..." -ForegroundColor Green
        & forge init --no-commit --force
    } else {
        Write-Host "Foundry project already initialized in contracts/." -ForegroundColor Gray
    }
}

# Create standard foundry.toml if not present
if (-not (Test-Path "foundry.toml")) {
    $foundryConfig = @"
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200
evm_version = "cancun"

[rpc_endpoints]
sepolia = "`$SEPOLIA_RPC_URL"
arbitrum_sepolia = "`$ARBITRUM_SEPOLIA_RPC_URL"
anvil = "http://127.0.0.1:8545"
"@
    Set-Content -Path "foundry.toml" -Value $foundryConfig
    Write-Host "Created contracts/foundry.toml" -ForegroundColor Green
}

Set-Location $PSScriptRoot\..
Write-Host "[SUCCESS] Contracts subsystem initialization complete!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
