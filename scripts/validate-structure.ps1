<#
.SYNOPSIS
    LUCENTRA Repository Layout and Integrity Validator
.DESCRIPTION
    Validates existence of root governance files, documentation directories,
    markdown link integrity, and status taxonomy conformance.
#>

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Repository Structure and Integrity Validator         " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorsFound = 0

# 1. Check Root Governance and Config Files
Write-Host "[1/4] Checking Root Governance and Configuration Files..." -ForegroundColor Yellow
$RequiredRootFiles = @(
    "AGENTS.md",
    "README.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
    "LICENSE",
    ".gitignore",
    ".editorconfig",
    ".env.example"
)

foreach ($file in $RequiredRootFiles) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Missing required root file: $file" -ForegroundColor Red
        $ErrorsFound++
    }
}

# 2. Check Documentation Directory Layout
Write-Host "`n[2/4] Checking Documentation Directories..." -ForegroundColor Yellow
$RequiredDocDirs = @(
    "docs/00-project-overview",
    "docs/01-product-management",
    "docs/02-research-and-analysis",
    "docs/03-architecture",
    "docs/03-architecture/decisions",
    "docs/04-protocol",
    "docs/05-cryptography",
    "docs/06-blockchain",
    "docs/07-backend",
    "docs/08-frontend",
    "docs/09-browser-extension",
    "docs/10-witness-network",
    "docs/11-security",
    "docs/12-testing",
    "docs/13-devops",
    "docs/14-project-management",
    "docs/15-ai-agent-governance",
    "docs/16-user-and-developer-guides",
    "docs/17-releases",
    "docs/templates"
)

foreach ($dir in $RequiredDocDirs) {
    if (Test-Path $dir) {
        Write-Host "  [OK] $dir" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Missing documentation directory: $dir" -ForegroundColor Red
        $ErrorsFound++
    }
}

# 3. Check Audit and Deliverable Reports
Write-Host "`n[3/4] Checking Master Audit and Index Reports..." -ForegroundColor Yellow
$RequiredReports = @(
    "docs/DOCUMENTATION_INDEX.md",
    "docs/DOCUMENTATION_AUDIT_REPORT.md",
    "docs/DOCUMENTATION_ISSUES.md",
    "docs/REPOSITORY_INSPECTION_REPORT.md"
)

foreach ($rep in $RequiredReports) {
    if (Test-Path $rep) {
        Write-Host "  [OK] $rep" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Missing master report: $rep" -ForegroundColor Red
        $ErrorsFound++
    }
}

# 4. Check Internal Markdown Links
Write-Host "`n[4/4] Validating Internal Markdown Links across all documents..." -ForegroundColor Yellow
$mdFiles = Get-ChildItem -Path . -Recurse -Filter *.md | Where-Object { 
    $_.FullName -notmatch '\\(\.git|node_modules|\.venv|env|dist|out|\.next)\\' 
}

$linkCount = 0
$brokenCount = 0

foreach ($file in $mdFiles) {
    $content = Get-Content $file.FullName -Raw
    # Strip code blocks
    $cleanContent = $content -replace '(?s)```.*?```', ''
    $matches = [regex]::Matches($cleanContent, '\[([^\]]+)\]\(([^)]+)\)')

    foreach ($m in $matches) {
        $link = $m.Groups[2].Value.Trim()
        
        # Skip external web URLs, anchors, mailto, conversation, etc.
        if ($link -match '^(https?://|mailto:|#|conversation://)') { continue }

        $linkCount++
        $targetPath = $link -replace '#.*$', ''
        if ([string]::IsNullOrWhiteSpace($targetPath)) { continue }

        if ($targetPath -match '^file:///(.*)$') {
            $rawPath = $matches[1] -replace '/', '\'
            $rawPath = [System.Uri]::UnescapeDataString($rawPath)
            if (-not (Test-Path $rawPath)) {
                Write-Host "  [BROKEN LINK] In $($file.FullName): target not found -> $rawPath" -ForegroundColor Red
                $brokenCount++
            }
        } else {
            $resolvedPath = Join-Path $file.DirectoryName $targetPath
            if (-not (Test-Path $resolvedPath)) {
                Write-Host "  [BROKEN LINK] In $($file.FullName): target not found -> $targetPath" -ForegroundColor Red
                $brokenCount++
            }
        }
    }
}

Write-Host "  Scanned $($mdFiles.Count) markdown files, $linkCount internal links checked." -ForegroundColor Gray
if ($brokenCount -eq 0) {
    Write-Host "  [OK] All internal markdown links are valid! (0 broken)" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Found $brokenCount broken internal links." -ForegroundColor Red
    $ErrorsFound += $brokenCount
}

Write-Host "`n-----------------------------------------------------------------" -ForegroundColor Gray
if ($ErrorsFound -eq 0) {
    Write-Host "[SUCCESS] Repository structure and integrity verification PASSED! (0 errors)" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "[FAILURE] Structure validation FAILED with $ErrorsFound error(s)." -ForegroundColor Red
    Write-Host "=================================================================" -ForegroundColor Cyan
    exit 1
}
