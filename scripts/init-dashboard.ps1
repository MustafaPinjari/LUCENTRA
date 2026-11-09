<#
.SYNOPSIS
    LUCENTRA Dashboard Subsystem Scaffolding Script
.DESCRIPTION
    Initializes the Next.js 14+ / React / Tailwind dashboard in apps/dashboard/.
#>

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   LUCENTRA -- Dashboard Subsystem Initialization (Next.js)       " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$DashboardDir = Join-Path $PSScriptRoot "..\apps\dashboard"

if (-not (Test-Path $DashboardDir)) {
    New-Item -ItemType Directory -Path $DashboardDir -Force | Out-Null
}

Set-Location $DashboardDir

# Check if package.json already exists
if (-not (Test-Path "package.json")) {
    $pkgJson = @"
{
  "name": "@lucentra/dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "viem": "^2.10.8",
    "wagmi": "^2.9.2",
    "@tanstack/react-query": "^5.37.1",
    "lucide-react": "^0.378.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/node": "^20.12.12",
    "@types/react": "^18.3.2",
    "@types/react-dom": "^18.3.0",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.3"
  }
}
"@
    Set-Content -Path "package.json" -Value $pkgJson
    Write-Host "Created apps/dashboard/package.json" -ForegroundColor Green
} else {
    Write-Host "apps/dashboard/package.json already exists." -ForegroundColor Gray
}

# tsconfig.json
if (-not (Test-Path "tsconfig.json")) {
    $tsConfig = @"
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
"@
    Set-Content -Path "tsconfig.json" -Value $tsConfig
    Write-Host "Created apps/dashboard/tsconfig.json" -ForegroundColor Green
}

@("src/app", "src/components", "src/lib") | ForEach-Object {
    $p = Join-Path $DashboardDir $_
    if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

Set-Location $PSScriptRoot\..
Write-Host "[SUCCESS] Dashboard subsystem initialization complete!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
