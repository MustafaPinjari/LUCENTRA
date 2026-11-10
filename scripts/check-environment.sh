#!/usr/bin/env bash
# ==============================================================================
# LUCENTRA — Development Environment Diagnostic Utility (Bash)
# ==============================================================================

set -u

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=================================================================${NC}"
echo -e "${CYAN}   LUCENTRA — Development Environment Diagnostic Utility        ${NC}"
echo -e "${CYAN}=================================================================${NC}"
echo ""

ALL_READY=true

check_tool() {
  local name="$1"
  local cmd="$2"
  local args="$3"
  local required_desc="$4"
  local install_help="$5"
  local mandatory="${6:-true}"

  printf "[*] Checking for %-20s ... " "$name"

  if command -v "$cmd" >/dev/null 2>&1; then
    local version
    version=$("$cmd" $args 2>&1 | head -n 1)
    echo -e "${GREEN}FOUND${NC} ($version)"
    return 0
  else
    if [ "$mandatory" = "true" ]; then
      echo -e "${RED}MISSING${NC}"
      echo "    Requirement : $required_desc"
      echo "    Install via : $install_help"
      ALL_READY=false
      return 1
    else
      echo -e "${YELLOW}OPTIONAL (Not installed)${NC}"
      echo "    Note        : $install_help"
      return 1
    fi
  fi
}

check_tool "Node.js" "node" "--version" "Node.js v18+" "https://nodejs.org or nvm" "true"
check_tool "npm" "npm" "--version" "npm v9+" "Included with Node.js" "true"
check_tool "Python" "python3" "--version" "Python 3.11+" "https://python.org or apt install python3" "true"
check_tool "pip" "pip3" "--version" "pip3" "python3 -m ensurepip" "true"
check_tool "Git" "git" "--version" "Git 2.30+" "https://git-scm.com" "true"
check_tool "Foundry (forge)" "forge" "--version" "Foundry toolchain" "curl -L https://foundry.paradigm.xyz | bash && foundryup" "false"

echo ""
echo "-----------------------------------------------------------------"
if [ "$ALL_READY" = "true" ]; then
  echo -e "${GREEN}[SUCCESS] Core runtime prerequisites are installed!${NC}"
else
  echo -e "${RED}[WARNING] Missing required dependencies. Please install them before proceeding.${NC}"
fi
echo -e "${CYAN}=================================================================${NC}"
