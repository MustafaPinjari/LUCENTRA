# Installation Guide — LUCENTRA

**Document ID:** LUC-USR-001  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides complete installation and environment setup instructions for developers running the LUCENTRA stack locally.

---

## 2. System Prerequisites

- **Operating System:** Linux, macOS, or Windows 11 (WSL2 recommended for Windows).
- **Node.js:** v20.10.0+ (LTS)
- **npm:** v9.0.0+ (or **pnpm:** v9.0.0+)
- **Python:** v3.11+
- **Foundry:** Latest stable build (`foundryup`)
- **No Docker Required:** Native development runs directly on local Node and Python runtimes with SQLite.

---

## 3. Step-by-Step Installation

### 3.1 Clone the Monorepo
```bash
git clone https://github.com/lucentra/lucentra.git
cd lucentra
```

### 3.2 Install Dependencies
```bash
# Run automated setup and environment diagnostics
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

# Install Foundry dependencies
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
cd ..

# Install Python backend dependencies
cd services/backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
cd ../..
```

### 3.3 Launch Services
```bash
# Start backend server (uses SQLite and eager Celery by default)
cd services/backend
python manage.py runserver 0.0.0.0:8000
```

---

## 4. Related Documents

- [docs/16-user-and-developer-guides/QUICK_START.md](QUICK_START.md)
- [docs/13-devops/DEVELOPMENT_ENVIRONMENT.md](../13-devops/DEVELOPMENT_ENVIRONMENT.md)

