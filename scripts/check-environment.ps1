<#
.SYNOPSIS
    LUCENTRA Environment Diagnostics and Tooling Verification Script
.DESCRIPTION
    Checks presence and versions of Node.js, npm, Python, pip, Git, and Foundry (forge)
    required for native LUCENTRA development without external container dependencies.
#>

$ErrorActionPreference = "Continue"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Development Environment Diagnostic Utility        " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$AllReady = $true
$MissingTools = @()

function Check-Tool {
    param (
        [string]$Name,
        [string]$Command,
        [string[]]$CommandArgs,
        [string]$RequiredVersionDesc,
        [string]$InstallHelp,
        [bool]$Mandatory = $true
    )

    Write-Host -NoNewline "[*] Checking for $Name... "
    $cmdPath = Get-Command $Command -ErrorAction SilentlyContinue

    if ($cmdPath) {
        try {
            $ver = (& $Command $CommandArgs 2>&1 | Out-String).Trim()
            $firstLine = ($ver -split "`r?`n")[0]
            Write-Host "FOUND ($firstLine)" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "FOUND" -ForegroundColor Green
            return $true
        }
    } else {
        if ($Mandatory) {
            Write-Host "MISSING" -ForegroundColor Red
            Write-Host "    Requirement : $RequiredVersionDesc" -ForegroundColor DarkGray
            Write-Host "    Install via : $InstallHelp" -ForegroundColor DarkGray
            $script:AllReady = $false
            $script:MissingTools += $Name
            return $false
        } else {
            Write-Host "OPTIONAL (Not installed)" -ForegroundColor DarkYellow
            Write-Host "    Note        : $InstallHelp" -ForegroundColor DarkGray
            return $false
        }
    }
}

# 1. Node.js (v18+ or v20+ recommended)
$null = Check-Tool -Name "Node.js" -Command "node" -CommandArgs @("--version") `
    -RequiredVersionDesc "Node.js v18.0.0 or higher" `
    -InstallHelp "https://nodejs.org or winget install OpenJS.NodeJS.LTS"

# 2. npm (npm.cmd on Windows)
$npmCmd = if (Get-Command "npm.cmd" -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }
$null = Check-Tool -Name "npm" -Command $npmCmd -CommandArgs @("--version") `
    -RequiredVersionDesc "npm v9.0.0 or higher" `
    -InstallHelp "Included with Node.js"

# 3. Python 3
$null = Check-Tool -Name "Python" -Command "python" -CommandArgs @("--version") `
    -RequiredVersionDesc "Python 3.11 or higher" `
    -InstallHelp "https://python.org or winget install Python.Python.3.11"

# 4. pip
$null = Check-Tool -Name "pip" -Command "pip" -CommandArgs @("--version") `
    -RequiredVersionDesc "pip package manager" `
    -InstallHelp "python -m ensurepip --upgrade"

# 5. Git
$null = Check-Tool -Name "Git" -Command "git" -CommandArgs @("--version") `
    -RequiredVersionDesc "Git 2.30+" `
    -InstallHelp "https://git-scm.com or winget install Git.Git"

# 6. Foundry (forge)
$forgeFound = Check-Tool -Name "Foundry (forge)" -Command "forge" -CommandArgs @("--version") `
    -RequiredVersionDesc "Foundry toolchain (forge 0.2.0+)" `
    -InstallHelp "powershell -c `"irm https://foundry.paradigm.xyz | iex`" then foundryup" `
    -Mandatory $false

Write-Host ""
Write-Host "-----------------------------------------------------------------" -ForegroundColor Gray

if ($AllReady) {
    Write-Host "[SUCCESS] Core runtime prerequisites (Node, npm, Python, Git) are installed!" -ForegroundColor Green
    if (-not $forgeFound) {
        Write-Host "[NOTE] Foundry (forge) is recommended for smart contract development in contracts/." -ForegroundColor Yellow
        Write-Host "       Install via: powershell -c `"irm https://foundry.paradigm.xyz | iex`" then foundryup" -ForegroundColor DarkGray
    }
} else {
    Write-Host "[WARNING] Missing required dependencies: $($MissingTools -join ', ')" -ForegroundColor Red
    Write-Host "Please install missing dependencies before running initialization scripts." -ForegroundColor Yellow
}

Write-Host "=================================================================" -ForegroundColor Cyan
