$ErrorActionPreference = "Stop"

$binDir = Join-Path $env:USERPROFILE ".foundry\bin"
if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

$zipPath = Join-Path $env:TEMP "foundry_win32.zip"
$url = "https://github.com/foundry-rs/foundry/releases/download/v1.9.0/foundry_v1.9.0_win32_amd64.zip"

Write-Host "Downloading Foundry v1.9.0 for Windows..." -ForegroundColor Cyan
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $url -OutFile $zipPath

Write-Host "Extracting to $binDir..." -ForegroundColor Cyan
Expand-Archive -Path $zipPath -DestinationPath $binDir -Force

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$forgeExe = Join-Path $binDir "forge.exe"
if (Test-Path $forgeExe) {
    Write-Host "Foundry installed successfully!" -ForegroundColor Green
    & $forgeExe --version
} else {
    Write-Host "Error: forge.exe not found after extraction" -ForegroundColor Red
}

# Also copy to workspace .bin directory so sandboxed executions have direct access
$wsBin = Join-Path $PSScriptRoot "..\.bin"
if (-not (Test-Path $wsBin)) {
    New-Item -ItemType Directory -Path $wsBin -Force | Out-Null
}
Copy-Item (Join-Path $binDir "*") $wsBin -Force
Write-Host "Copied Foundry binaries to workspace .bin directory." -ForegroundColor Green

