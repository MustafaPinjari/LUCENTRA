# Development Environment Setup — LUCENTRA

**Document ID:** LUC-OPS-001  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides complete, reproducible instructions for setting up the local multi-tier development environment for LUCENTRA.

---

## 2. Prerequisites & Toolchain Versions

- **Node.js:** v20.x LTS or higher
- **Package Manager:** `pnpm` (v9+)
- **Python:** v3.11 or v3.12 (with `poetry` or `venv`)
- **Foundry:** `forge`, `cast`, `anvil` (latest stable)
- **Docker & Docker Compose:** Docker Engine v24+

---

## 3. Quickstart Bootstrap Script

```bash
# 1. Clone & Enter Repository
git clone https://github.com/lucentra/lucentra.git
cd lucentra

# 2. Start PostgreSQL & Redis via Docker
docker compose up -d postgres redis

# 3. Setup Python Backend
cd services/backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000 &

# 4. Setup Smart Contracts & Local Anvil Node
cd ../../contracts
anvil --port 8545 &
forge build
forge test

# 5. Setup Next.js Dashboard & Chrome Extension
cd ..
pnpm install
pnpm --filter @lucentra/dashboard dev &
pnpm --filter @lucentra/extension build:watch
```

---

## 4. Related Documents

- [docs/13-devops/ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)
- [docs/16-user-and-developer-guides/QUICK_START.md](../16-user-and-developer-guides/QUICK_START.md)

---

## 5. References

- [Foundry Installation](https://book.getfoundry.sh/getting-started/installation)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

