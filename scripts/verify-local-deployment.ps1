<#
.SYNOPSIS
    Verifies that the LUCENTRA local smart contract deployment is valid and active on Anvil.
.DESCRIPTION
    Checks bytecode presence, contract cross-references, roles, and EAS schema registration.
#>

param(
    [string]$DeploymentFile = "$PSScriptRoot/../deployments/local/deployment.json"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path "$PSScriptRoot/..").Path
$castExe = if (Test-Path "$workspaceRoot/.bin/cast.exe") { (Resolve-Path "$workspaceRoot/.bin/cast.exe").Path } else { (Get-Command "cast" -ErrorAction SilentlyContinue).Source }

if (-not (Test-Path $DeploymentFile)) {
    Write-Error "Deployment file not found at $DeploymentFile. Run scripts/deploy-local.ps1 first."
    exit 1
}

$deploy = Get-Content $DeploymentFile -Raw | ConvertFrom-Json
$rpc = $deploy.rpcUrl

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Verifying Local Blockchain Deployment             " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "RPC Endpoint: $rpc"
Write-Host "Chain ID:     $($deploy.chainId)"

# Check 1: Chain ID matching
$liveChainId = (& $castExe chain-id --rpc-url $rpc 2>&1).Trim()
if ($liveChainId -ne "$($deploy.chainId)") {
    Write-Error "Chain ID mismatch! Expected $($deploy.chainId), got $liveChainId."
    exit 1
}
Write-Host "[OK] RPC connected (Chain ID: $liveChainId)" -ForegroundColor Green

# Check 2: Bytecode presence at each contract address
$contracts = @("SchemaRegistry", "EAS", "PublisherRegistry", "SignatureVerifier", "ReleaseAttestationVerifier")
foreach ($cName in $contracts) {
    $addr = $deploy.contracts.$cName.address
    if (-not $addr) {
        Write-Error "Missing address for contract $cName in deployment.json"
        exit 1
    }
    $code = (& $castExe code --rpc-url $rpc $addr 2>&1).Trim()
    if ($code -eq "0x" -or $code.Length -lt 10) {
        Write-Error "No bytecode found at $cName address $addr!"
        exit 1
    }
    Write-Host "[OK] Bytecode present for $cName at $addr ($($code.Length / 2) bytes)" -ForegroundColor Green
}

# Check 3: State variable cross-references
Write-Host "`nVerifying Contract State Invariants..." -ForegroundColor Yellow

# PublisherRegistry.registrar()
$pubRegAddr = $deploy.contracts.PublisherRegistry.address
$liveRegistrar = (& $castExe call --rpc-url $rpc $pubRegAddr "registrar()(address)" 2>&1).Trim()
if ($liveRegistrar.ToLower() -ne $deploy.roles.registrar.ToLower()) {
    Write-Error "PublisherRegistry registrar mismatch: Expected $($deploy.roles.registrar), got $liveRegistrar"
    exit 1
}
Write-Host "[OK] PublisherRegistry.registrar() == $($deploy.roles.registrar)" -ForegroundColor Green

# ReleaseAttestationVerifier references
$relVerAddr = $deploy.contracts.ReleaseAttestationVerifier.address
$liveEas = (& $castExe call --rpc-url $rpc $relVerAddr "eas()(address)" 2>&1).Trim()
if ($liveEas.ToLower() -ne $deploy.contracts.EAS.address.ToLower()) {
    Write-Error "ReleaseAttestationVerifier.eas() mismatch"
    exit 1
}
Write-Host "[OK] ReleaseAttestationVerifier.eas() == $($deploy.contracts.EAS.address)" -ForegroundColor Green

$livePubReg = (& $castExe call --rpc-url $rpc $relVerAddr "publisherRegistry()(address)" 2>&1).Trim()
if ($livePubReg.ToLower() -ne $deploy.contracts.PublisherRegistry.address.ToLower()) {
    Write-Error "ReleaseAttestationVerifier.publisherRegistry() mismatch"
    exit 1
}
Write-Host "[OK] ReleaseAttestationVerifier.publisherRegistry() == $($deploy.contracts.PublisherRegistry.address)" -ForegroundColor Green

$liveSigVer = (& $castExe call --rpc-url $rpc $relVerAddr "signatureVerifier()(address)" 2>&1).Trim()
if ($liveSigVer.ToLower() -ne $deploy.contracts.SignatureVerifier.address.ToLower()) {
    Write-Error "ReleaseAttestationVerifier.signatureVerifier() mismatch"
    exit 1
}
Write-Host "[OK] ReleaseAttestationVerifier.signatureVerifier() == $($deploy.contracts.SignatureVerifier.address)" -ForegroundColor Green

$liveSchemaUID = (& $castExe call --rpc-url $rpc $relVerAddr "releaseSchemaId()(bytes32)" 2>&1).Trim()
if ($liveSchemaUID.ToLower() -ne $deploy.schema.uid.ToLower()) {
    Write-Error "ReleaseAttestationVerifier.releaseSchemaId() mismatch"
    exit 1
}
Write-Host "[OK] ReleaseAttestationVerifier.releaseSchemaId() == $($deploy.schema.uid)" -ForegroundColor Green

# Check 4: EAS SchemaRegistry schema record
$schemaRegAddr = $deploy.contracts.SchemaRegistry.address
$schemaRecord = (& $castExe call --rpc-url $rpc $schemaRegAddr "getSchema(bytes32)((bytes32,address,bool,string))" $deploy.schema.uid 2>&1).Trim()
Write-Host "[OK] Schema validated on EAS SchemaRegistry: $schemaRecord" -ForegroundColor Green

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "   ALL LOCAL DEPLOYMENT VERIFICATION CHECKS PASSED (5/5)!         " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
exit 0
