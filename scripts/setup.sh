#!/usr/bin/env bash
# ==============================================================================
# LUCENTRA — Monorepo Workspace Initialization (Bash)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "================================================================="
echo "   LUCENTRA — Monorepo Workspace Initialization                  "
echo "================================================================="
echo ""

# 1. Directory Structure
echo "[1/3] Ensuring Monorepo Directory Layout..."
SUBSYSTEMS=(
  "apps/dashboard"
  "apps/extension"
  "services/backend"
  "services/witness"
  "contracts"
  "packages/core"
  "packages/cli"
)

for sub in "${SUBSYSTEMS[@]}"; do
  dir_path="$ROOT_DIR/$sub"
  if [ ! -d "$dir_path" ]; then
    mkdir -p "$dir_path"
    echo "  [CREATED] $sub"
  else
    echo "  [EXISTS]  $sub"
  fi
done

# 2. Environment Template Copying
echo ""
echo "[2/3] Setting up Local Environment Files..."
if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "  [COPIED] .env created from .env.example"
else
  echo "  [EXISTS] .env already present (skipped copy)"
fi

# 3. Diagnostic Check
echo ""
echo "[3/3] Running Environment Diagnostic Checks..."
bash "$SCRIPT_DIR/check-environment.sh"

echo ""
echo "================================================================="
echo "   Initialization Complete! Next Steps for Implementation:      "
echo "   - contracts/        : Run ./scripts/init-contracts.ps1"
echo "   - services/backend/ : Run ./scripts/init-backend.ps1"
echo "   - apps/dashboard/   : Run ./scripts/init-dashboard.ps1"
echo "   - apps/extension/   : Run ./scripts/init-extension.ps1"
echo "================================================================="
