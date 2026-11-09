<#
.SYNOPSIS
    LUCENTRA Chrome Extension Subsystem Scaffolding Script
.DESCRIPTION
    Initializes the Manifest V3 Chrome Extension development environment in apps/extension/.
#>

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA — Extension Subsystem Initialization (Chrome MV3)    " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$ExtensionDir = Join-Path $PSScriptRoot "..\apps\extension"

if (-not (Test-Path $ExtensionDir)) {
    New-Item -ItemType Directory -Path $ExtensionDir -Force | Out-Null
}

Set-Location $ExtensionDir

if (-not (Test-Path "package.json")) {
    $pkgJson = @"
{
  "name": "@lucentra/extension",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "vite build",
    "watch": "vite build --watch",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "viem": "^2.10.8"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "@types/node": "^20.12.12",
    "typescript": "^5.4.5",
    "vite": "^5.2.11"
  }
}
"@
    Set-Content -Path "package.json" -Value $pkgJson
    Write-Host "Created apps/extension/package.json" -ForegroundColor Green
} else {
    Write-Host "apps/extension/package.json already exists." -ForegroundColor Gray
}

# Manifest V3 template
if (-not (Test-Path "manifest.json")) {
    $manifestJson = @"
{
  "manifest_version": 3,
  "name": "LUCENTRA — Cryptographic Web Integrity Verifier",
  "version": "0.1.0",
  "description": "Verifies website publisher identity and JavaScript resource integrity through EAS attestations.",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "http://*/*",
    "https://*/*"
  ],
  "background": {
    "service_worker": "dist/background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/content/observer.js"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_title": "LUCENTRA Integrity Status",
    "default_popup": "popup.html"
  }
}
"@
    Set-Content -Path "manifest.json" -Value $manifestJson
    Write-Host "Created apps/extension/manifest.json" -ForegroundColor Green
}

@("src/background", "src/content", "src/workers", "src/popup") | ForEach-Object {
    $p = Join-Path $ExtensionDir $_
    if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

Set-Location $PSScriptRoot\..
Write-Host "[SUCCESS] Extension subsystem initialization complete!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
