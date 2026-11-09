# Quick Start Guide — LUCENTRA

**Document ID:** LUC-USR-002  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides a 5-minute quickstart walkthrough for spinning up the local LUCENTRA verification demonstration.

---

## 2. 5-Minute Verification Walkthrough

### Step 1: Start Background Services
```bash
docker compose up -d postgres redis
```

### Step 2: Run Local Anvil Blockchain Node
```bash
cd contracts
anvil --port 8545 &
forge script script/DeployPublisherRegistry.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### Step 3: Start Backend API
```bash
cd ../services/backend
source .venv/bin/activate
python manage.py migrate
python manage.py runserver 8000 &
```

### Step 4: Load Chrome Extension in Developer Mode
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in top right).
3. Click **Load unpacked** and select `apps/extension/dist`.
4. The gray LUCENTRA shield icon appears in your toolbar.

### Step 5: Test Verification
Navigate to `http://localhost:3000/demo-site`. Observe the toolbar icon transform into an **Emerald Green Shield (✓)** indicating authentic publisher verification!

---

## 3. Related Documents

- [docs/16-user-and-developer-guides/INSTALLATION.md](INSTALLATION.md)
- [docs/16-user-and-developer-guides/PUBLISHER_GUIDE.md](PUBLISHER_GUIDE.md)

