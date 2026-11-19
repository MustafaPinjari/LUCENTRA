# LUCENTRA — Sprint 5 Demonstration & Hackathon Runbook

**Document ID:** LUC-DEMO-001  
**Version:** 1.0.0  
**Status:** APPROVED  
**Date:** 2026-11-19  
**Milestone:** Startup Buildathon India 2026  
**Execution Environment:** Windows 11 Enterprise (PowerShell), Chromium / Microsoft Edge, Anvil Local (31337)

---

## 1. Overview

This document provides step-by-step instructions for running the complete, locally demonstrable LUCENTRA verification lifecycle for **Startup Buildathon India 2026**.

The demonstration covers:
1. **The Publisher Journey:** Onboarding an origin domain, verifying DNS TXT challenges, authorizing publisher wallets via EIP-712, creating canonical release manifests, and obtaining on-chain EAS attestations.
2. **The Visitor Journey:** Navigating to the website, executing out-of-band SHA-256 byte verification in the Chrome MV3 extension, viewing cryptographic proofs, and triggering real-time Google Gemini AI explanations.
3. **The Tamper Attack Scenario:** Simulating an unauthorized script modification (CDN compromise / Magecart injection) and demonstrating how LUCENTRA detects the mismatch and Gemini explains the threat to the user.

---

## 2. Multi-Terminal Startup Sequence

Open **4 PowerShell terminals** in `C:\Users\mustafa\Desktop\LUCENTRA`:

### Terminal 1 — Local Blockchain Node (Anvil)
```powershell
# Start local EVM blockchain with Chain ID 31337
anvil --port 8545 --chain-id 31337
```
*Expected Output:* Listening on `127.0.0.1:8545`, showing 10 funded accounts (10,000 ETH each).

---

### Terminal 2 — Deploy Smart Contracts & EAS Schema
```powershell
# Deploy PublisherRegistry, SignatureVerifier, ReleaseAttestationVerifier, and EAS
powershell -ExecutionPolicy Bypass -File scripts/deploy-local.ps1
```
*Expected Output:*
- PublisherRegistry deployed to `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
- SignatureVerifier deployed to `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`
- EAS deployed to `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- EAS Schema UID registered: `0xac04bb1a769e2c3647d6b15fbb4459e8d708947771b94466bf8f648b3c8c3b50`

---

### Terminal 3 — Django Backend Engine
```powershell
# Migrate database and launch REST API server on port 8000
python services/backend/manage.py migrate
python services/backend/manage.py runserver 8000
```
*Expected Output:* `Starting development server at http://127.0.0.1:8000/`

---

### Terminal 4 — Next.js Publisher Dashboard
```powershell
# Launch Next.js Dashboard on port 3000
npm.cmd --prefix apps/dashboard run dev
```
*Expected Output:* `Ready in 1500ms on http://localhost:3000`

---

## 3. Step-by-Step Demonstration Walkthrough

### Part A: The Publisher Onboarding Journey
1. **Open Dashboard:** Navigate to `http://localhost:3000/dashboard` in Chrome or Edge.
2. **Connect Wallet:** Click **"Connect Wallet"** in the top navigation bar. Select Anvil Account 2 (`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`).
3. **Register Domain:**
   - Go to **Domain Management** (`/dashboard/domains`).
   - Click **"+ Add Domain"**.
   - Enter `portal.acme-corp.com`.
   - Click **"Generate DNS TXT Challenge →"**.
4. **Complete DNS Validation:**
   - The wizard displays the formatted DNS TXT record:
     - Name: `_lucentra-verification.portal.acme-corp.com`
     - Value: `lucentra-challenge=...`
   - Click **"Verify DNS Record →"** (in local development, the backend automatically validates the challenge).
5. **Sign On-Chain Registration:**
   - Click **"Sign EIP-712 & Register On-Chain"**.
   - Approve the EIP-712 signature prompt in your wallet.
   - The backend registrar submits the transaction to `PublisherRegistry.sol`.
   - Transaction hash is displayed, and the domain status becomes **`REGISTERED_ONCHAIN`**.
6. **Create & Attest Release:**
   - Navigate to **Release Management** (`/dashboard/releases`).
   - Click **"+ Create & Sign Release"**.
   - Enter Version `1.0.0`.
   - Specify or upload the build asset `/static/js/main.js` (computed hash: `sha256:e3b0c442...`).
   - Click **"Sign Release with Wallet & Attest"**.
   - Sign the typed `ReleaseManifest` in your wallet.
   - The manifest is attested to EAS, and the attestation UID (`0x...`) is confirmed.

---

### Part B: The Visitor & Browser Extension Journey
1. **Load Unpacked Extension:**
   - Open `chrome://extensions` (or `edge://extensions`).
   - Enable **Developer mode**.
   - Click **"Load unpacked"** and select `C:\Users\mustafa\Desktop\LUCENTRA\apps\extension\dist`.
2. **Verify Website:**
   - Navigate to the verified demo site (`http://localhost:8080` or `http://127.0.0.1:3000`).
   - Observe the extension icon badge turn **Green `✓`**.
   - Open the popup: Status displays **`VERIFIED_RELEASE_MATCH`** (All declared scripts match).
3. **Explain with Gemini AI:**
   - In the popup, click **"✨ Explain with Gemini"**.
   - The AI Explainer queries `gemini-3.8-flash` via the backend proxy.
   - A structured security card appears:
     - **Risk Level:** `LOW RISK`
     - **Headline:** Declared JavaScript resources match publisher-signed release manifest.
     - **Explanation:** Plain-English summary explaining that byte integrity and publisher identity are proven, while explicitly disclosing that integrity does not guarantee runtime code safety.

---

### Part C: The Tamper Attack Demonstration
1. **Simulate Script Injection:**
   - Open the **Security Insights** page in the dashboard (`/dashboard/insights`).
   - Click **"Simulate Resource Tamper"**.
   - The dashboard injects a simulated hash mismatch on `/static/js/checkout.bundle.js`.
2. **Observe Deterministic Detection:**
   - The protocol verification state immediately shifts to **`UNVERIFIED_RESOURCE_DETECTED`**.
3. **AI Threat Interpretation:**
   - Gemini automatically synthesizes the discrepancy:
     - **Risk Level:** `HIGH RISK`
     - **Headline:** JavaScript resource hash mismatch detected on declared bundle.
     - **Technical Breakdown:** Identifies the expected hash vs observed hash difference.
     - **Actionable Guidance:** Recommends halting checkout interactions, inspecting CDN origins, and auditing CI/CD deployment pipelines.

