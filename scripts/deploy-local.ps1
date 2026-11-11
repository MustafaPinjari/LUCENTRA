<#
.SYNOPSIS
    Deploys the LUCENTRA smart contract system to a local Anvil blockchain.
.DESCRIPTION
    Executes contracts/script/DeployLocal.s.sol via Forge, deploying in dependency order:
    1. SchemaRegistry (EAS)
    2. EAS (Ethereum Attestation Service)
    3. Release Attestation Schema on SchemaRegistry
    4. PublisherRegistry
    5. SignatureVerifier
    6. ReleaseAttestationVerifier
    Exports configuration, transaction receipts, and ABIs to deployments/local/.
#>

param(
    [string]$RpcUrl = "http://127.0.0.1:8545"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path "$PSScriptRoot/..").Path
$contractsDir = Join-Path $workspaceRoot "contracts"
$deploymentsDir = Join-Path $workspaceRoot "deployments/local"
$abiDir = Join-Path $deploymentsDir "abi"

if (-not (Test-Path $deploymentsDir)) { New-Item -ItemType Directory -Path $deploymentsDir -Force | Out-Null }
if (-not (Test-Path $abiDir)) { New-Item -ItemType Directory -Path $abiDir -Force | Out-Null }

# 1. Locate binaries
$forgeExe = if (Test-Path "$workspaceRoot/.bin/forge.exe") { (Resolve-Path "$workspaceRoot/.bin/forge.exe").Path } else { (Get-Command "forge" -ErrorAction SilentlyContinue).Source }
$castExe = if (Test-Path "$workspaceRoot/.bin/cast.exe") { (Resolve-Path "$workspaceRoot/.bin/cast.exe").Path } else { (Get-Command "cast" -ErrorAction SilentlyContinue).Source }

if (-not $forgeExe -or -not $castExe) {
    Write-Error "Foundry forge/cast binaries not found. Check .bin/ directory or system PATH."
    exit 1
}

# 2. Verify RPC connection
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Local Blockchain Deployment                        " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "RPC Endpoint: $RpcUrl"

try {
    $chainId = (& $castExe chain-id --rpc-url $RpcUrl 2>&1).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $chainId) {
        Write-Host "[INFO] Anvil not responding. Attempting to start local chain..." -ForegroundColor Yellow
        & powershell -ExecutionPolicy Bypass -File "$PSScriptRoot/local-chain.ps1"
        $chainId = (& $castExe chain-id --rpc-url $RpcUrl 2>&1).Trim()
    }
} catch {
    Write-Error "Unable to connect to local blockchain at $RpcUrl."
    exit 1
}

Write-Host "Connected to Chain ID: $chainId" -ForegroundColor Green
if ($chainId -ne "31337") {
    Write-Error "Safety check failed: Local deployment must only target local chain ID 31337. Detected: $chainId."
    exit 1
}

# 3. Deterministic Development Accounts
$deployerKey  = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
$deployerAddr = (& $castExe wallet address --private-key $deployerKey).Trim()

$registrarKey  = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
$registrarAddr = (& $castExe wallet address --private-key $registrarKey).Trim()

$publisherKey  = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
$publisherAddr = (& $castExe wallet address --private-key $publisherKey).Trim()

$signingKeyPriv = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
$signingKeyAddr = (& $castExe wallet address --private-key $signingKeyPriv).Trim()

$relayerKey  = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"
$relayerAddr = (& $castExe wallet address --private-key $relayerKey).Trim()

$attackerKey  = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"
$attackerAddr = (& $castExe wallet address --private-key $attackerKey).Trim()

Write-Host "`nConfigured Protocol Roles:" -ForegroundColor Yellow
Write-Host "  Deployer/Governance: $deployerAddr"
Write-Host "  Registrar:           $registrarAddr"
Write-Host "  Publisher Wallet:    $publisherAddr"
Write-Host "  Release-Signing Key: $signingKeyAddr"
Write-Host "  Relayer/Witness:     $relayerAddr"
Write-Host "  Attacker (Negative): $attackerAddr"

# 4. Execute Forge Deployment Script
Write-Host "`nExecuting Forge Deployment Script (DeployLocal.s.sol)..." -ForegroundColor Yellow
Push-Location $contractsDir
$scriptOutput = (& $forgeExe script script/DeployLocal.s.sol:DeployLocal --rpc-url $RpcUrl --broadcast -vvv 2>&1)
$exitCode = $LASTEXITCODE
Pop-Location

if ($exitCode -ne 0) {
    Write-Error "Deployment script failed:`n$($scriptOutput -join "`n")"
    exit 1
}

# 5. Parse Broadcast Artifacts
$broadcastPath = Join-Path $contractsDir "broadcast/DeployLocal.s.sol/31337/run-latest.json"
if (-not (Test-Path $broadcastPath)) {
    Write-Error "Broadcast file not found at $broadcastPath"
    exit 1
}

$broadcastJson = Get-Content $broadcastPath -Raw | ConvertFrom-Json
$txs = $broadcastJson.transactions

# Extract addresses from script output / logs
$schemaRegistryAddr = $null
$easAddr = $null
$schemaUID = $null
$pubRegAddr = $null
$sigVerAddr = $null
$relVerAddr = $null

foreach ($line in ($scriptOutput -split "`r?`n")) {
    if ($line -match "SchemaRegistry deployed at:\s+(0x[a-fA-F0-9]{40})") { $schemaRegistryAddr = $matches[1] }
    if ($line -match "EAS deployed at:\s+(0x[a-fA-F0-9]{40})") { $easAddr = $matches[1] }
    if ($line -match "(0x[a-fA-F0-9]{64})") {
        if (-not $schemaUID -and $line -notmatch "tx" -and $line -notmatch "0x0000000000") {
            $schemaUID = $matches[1]
        }
    }
    if ($line -match "PublisherRegistry deployed at:\s+(0x[a-fA-F0-9]{40})") { $pubRegAddr = $matches[1] }
    if ($line -match "SignatureVerifier deployed at:\s+(0x[a-fA-F0-9]{40})") { $sigVerAddr = $matches[1] }
    if ($line -match "ReleaseAttestationVerifier deployed at:\s+(0x[a-fA-F0-9]{40})") { $relVerAddr = $matches[1] }
}

# Transaction hashes from broadcast
$schemaRegTx = ($txs | Where-Object { $_.contractAddress -ieq $schemaRegistryAddr -and $_.transactionType -eq "CREATE" }).hash
$easTx       = ($txs | Where-Object { $_.contractAddress -ieq $easAddr -and $_.transactionType -eq "CREATE" }).hash
$schemaRegCallTx = ($txs | Where-Object { $_.contractAddress -ieq $schemaRegistryAddr -and $_.transactionType -eq "CALL" }).hash
$pubRegTx    = ($txs | Where-Object { $_.contractAddress -ieq $pubRegAddr }).hash
$sigVerTx    = ($txs | Where-Object { $_.contractAddress -ieq $sigVerAddr }).hash
$relVerTx    = ($txs | Where-Object { $_.contractAddress -ieq $relVerAddr }).hash

$schemaString = "bytes32 manifestHash,string domain,string version,uint64 sequence,bytes32 previousManifestHash,uint64 timestamp,uint64 expiresAt,address signingKey,bytes signature"

# 6. Export ABIs
Write-Host "`nExporting ABIs to deployments/local/abi/..." -ForegroundColor Cyan
Copy-Item (Join-Path $contractsDir "lib/eas-contracts/deployments/sepolia/SchemaRegistry.json") (Join-Path $abiDir "SchemaRegistry.json") -Force
Copy-Item (Join-Path $contractsDir "lib/eas-contracts/deployments/sepolia/EAS.json") (Join-Path $abiDir "EAS.json") -Force

$pubRegForge = Get-Content (Join-Path $contractsDir "out/PublisherRegistry.sol/PublisherRegistry.json") -Raw | ConvertFrom-Json
$pubRegForge | Select-Object abi | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $abiDir "PublisherRegistry.json")

$sigVerForge = Get-Content (Join-Path $contractsDir "out/SignatureVerifier.sol/SignatureVerifier.json") -Raw | ConvertFrom-Json
$sigVerForge | Select-Object abi | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $abiDir "SignatureVerifier.json")

$relVerForge = Get-Content (Join-Path $contractsDir "out/ReleaseAttestationVerifier.sol/ReleaseAttestationVerifier.json") -Raw | ConvertFrom-Json
$relVerForge | Select-Object abi | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $abiDir "ReleaseAttestationVerifier.json")

# 7. Write deployment artifact
$deploymentRecord = [ordered]@{
    network = "anvil-local"
    chainId = [int]$chainId
    rpcUrl = $RpcUrl
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    schema = [ordered]@{
        uid = $schemaUID
        raw = $schemaString
        resolver = "0x0000000000000000000000000000000000000000"
        revocable = $true
        transactionHash = $schemaRegCallTx
    }
    contracts = [ordered]@{
        SchemaRegistry = [ordered]@{
            address = $schemaRegistryAddr
            transactionHash = $schemaRegTx
        }
        EAS = [ordered]@{
            address = $easAddr
            transactionHash = $easTx
        }
        PublisherRegistry = [ordered]@{
            address = $pubRegAddr
            transactionHash = $pubRegTx
        }
        SignatureVerifier = [ordered]@{
            address = $sigVerAddr
            transactionHash = $sigVerTx
        }
        ReleaseAttestationVerifier = [ordered]@{
            address = $relVerAddr
            transactionHash = $relVerTx
        }
    }
    roles = [ordered]@{
        deployer   = $deployerAddr
        registrar  = $registrarAddr
        publisher  = $publisherAddr
        signingKey = $signingKeyAddr
        relayer    = $relayerAddr
        attacker   = $attackerAddr
    }
}

$deploymentJsonPath = Join-Path $deploymentsDir "deployment.json"
$deploymentJsonString = $deploymentRecord | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($deploymentJsonPath, $deploymentJsonString, [System.Text.UTF8Encoding]::new($false))

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "   DEPLOYMENT COMPLETED SUCCESSFULLY!                             " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Artifact saved to: $deploymentJsonPath"
Write-Host "Contracts deployed:"
Write-Host "  SchemaRegistry:             $schemaRegistryAddr"
Write-Host "  EAS:                        $easAddr"
Write-Host "  PublisherRegistry:          $pubRegAddr"
Write-Host "  SignatureVerifier:          $sigVerAddr"
Write-Host "  ReleaseAttestationVerifier: $relVerAddr"
Write-Host "  Schema UID:                 $schemaUID"
Write-Host "=================================================================" -ForegroundColor Cyan

exit 0
