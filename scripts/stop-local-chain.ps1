<#
.SYNOPSIS
    Stops the local Foundry Anvil blockchain for LUCENTRA.
.DESCRIPTION
    Terminates the local Anvil process using the saved PID file or port lookup.
#>

$ErrorActionPreference = "Continue"

$workspaceRoot = (Resolve-Path "$PSScriptRoot/..").Path
$deploymentsDir = Join-Path $workspaceRoot "deployments/local"
$pidFile = Join-Path $deploymentsDir "anvil.pid"

$stopped = $false

# 1. Stop by saved PID
if (Test-Path $pidFile) {
    $anvilPid = (Get-Content $pidFile -Raw).Trim()
    if ($anvilPid -match '^\d+$') {
        $proc = Get-Process -Id ([int]$anvilPid) -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "[INFO] Stopping Anvil process (PID $anvilPid)..." -ForegroundColor Yellow
            Stop-Process -Id ([int]$anvilPid) -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# 2. Stop any remaining process listening on port 8545
$conn = Get-NetTCPConnection -LocalPort 8545 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    foreach ($ownerPid in $conn.OwningProcess | Select-Object -Unique) {
        $p = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
        if ($p -and ($p.ProcessName -like "*anvil*" -or $p.ProcessName -like "*forge*")) {
            Write-Host "[INFO] Stopping lingering process on port 8545 (PID ${ownerPid}: $($p.ProcessName))..." -ForegroundColor Yellow
            Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    }
}

if ($stopped) {
    Write-Host "[OK] Anvil local blockchain stopped successfully." -ForegroundColor Green
} else {
    Write-Host "[INFO] No running Anvil process detected on port 8545." -ForegroundColor Yellow
}

exit 0
