<#
.SYNOPSIS
    Starts the local Foundry Anvil blockchain for LUCENTRA development and testing.
.DESCRIPTION
    Launches an isolated local EVM blockchain (Chain ID 31337, port 8545) with deterministic
    development accounts. Never connects to any public network.
#>

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path "$PSScriptRoot/..").Path
$deploymentsDir = Join-Path $workspaceRoot "deployments/local"
if (-not (Test-Path $deploymentsDir)) {
    New-Item -ItemType Directory -Path $deploymentsDir -Force | Out-Null
}

$pidFile = Join-Path $deploymentsDir "anvil.pid"
$logFile = Join-Path $deploymentsDir "anvil.log"
$errFile = Join-Path $deploymentsDir "anvil.err.log"

# 1. Check if Anvil is already running
$port = 8545
$existingConn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existingConn) {
    Write-Host "[INFO] Port $port is already in use (PID: $($existingConn.OwningProcess[0]))." -ForegroundColor Yellow
    # Test if RPC responds
    try {
        $body = '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$port" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 3
        if ($response.result -eq "0x7a69") { # 31337 in hex
            Write-Host "[OK] Existing Anvil local blockchain is healthy (Chain ID: 31337)." -ForegroundColor Green
            exit 0
        }
    } catch {
        Write-Host "[WARNING] Port $port is listening but not responding to Anvil RPC. Stopping existing process..." -ForegroundColor Yellow
        Stop-Process -Id $existingConn.OwningProcess[0] -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

# 2. Locate anvil executable
$anvilExe = $null
if (Test-Path "$workspaceRoot/.bin/anvil.exe") {
    $anvilExe = (Resolve-Path "$workspaceRoot/.bin/anvil.exe").Path
} else {
    $cmd = Get-Command "anvil" -ErrorAction SilentlyContinue
    if ($cmd) { $anvilExe = $cmd.Source }
}

if (-not $anvilExe) {
    Write-Error "Foundry 'anvil' executable not found. Please ensure .bin/anvil.exe or system PATH contains anvil."
    exit 1
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Starting Local Anvil Blockchain                    " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Binary:     $anvilExe"
Write-Host "Port:       $port"
Write-Host "Chain ID:   31337"
Write-Host "Log file:   $logFile"

# 3. Launch Anvil process
$startArgs = @(
    "--port", "8545",
    "--chain-id", "31337",
    "--block-time", "1"
)

$process = Start-Process -FilePath $anvilExe -ArgumentList $startArgs -RedirectStandardOutput $logFile -RedirectStandardError $errFile -PassThru -WindowStyle Hidden

if (-not $process -or $process.HasExited) {
    Write-Error "Failed to launch Anvil. Check $logFile for errors."
    exit 1
}

$process.Id | Out-File -FilePath $pidFile -Encoding ascii -Force
Write-Host "[INFO] Anvil process launched with PID $($process.Id)." -ForegroundColor Yellow

# 4. Wait for RPC readiness
$maxAttempts = 15
$ready = $false
for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Milliseconds 600
    try {
        $body = '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:$port" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 2
        if ($response.result -eq "0x7a69") {
            $ready = $true
            break
        }
    } catch {
        # Keep waiting
    }
}

if (-not $ready) {
    Write-Error "Anvil started but RPC at http://127.0.0.1:$port did not become ready within 10 seconds. Check $logFile."
    exit 1
}

Write-Host "[OK] Anvil local blockchain is ready and listening at http://127.0.0.1:$port!" -ForegroundColor Green
Write-Host "Chain ID:   31337"
Write-Host "PID:        $($process.Id)"
Write-Host "=================================================================" -ForegroundColor Cyan
exit 0
