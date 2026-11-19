# LUCENTRA — End-to-End Demonstration Readiness Assessment

**Document ID:** LUC-AUD-007  
**Version:** 1.0.0  
**Classification:** PRODUCT DEMO READINESS AUDIT  
**Audit Date:** 2026-11-19  
**Auditor:** Senior QA Lead & Blockchain Integration Architect  
**Repository Path:** `C:\Users\mustafa\Desktop\LUCENTRA`  
**Git Branch:** `security/sprint-4-2-hardening`  
**Target Milestone:** Startup Buildathon India 2026  

---

## 1. Executive Summary

A successful Buildathon submission requires an undeniable, demonstrable end-to-end workflow proving that the technology is real, integrated, and functioning.

This report evaluates the 11-step end-to-end user journey specified in the audit directive, categorizing each step's implementation state, analyzing manual vs. automated execution paths, and defining the minimum required engineering work to produce a seamless live demonstration.

---

## 2. Eleven-Step End-to-End Workflow Assessment

```
+-----------------------------------------------------------------------------------------------+
|                            LUCENTRA 11-STEP DEMO READINESS AUDIT                              |
+-----+---------------------------------------------+--------------------+----------------------+
| #   | Workflow Step                               | Current Status     | Execution Mechanism  |
+-----+---------------------------------------------+--------------------+----------------------+
| 1   | Publisher registers a domain                | WORKING (API/CLI)  | Django REST / curl   |
| 2   | Domain validated via DNS TXT record         | WORKING            | dnspython / mock DNS |
| 3   | Publisher wallet authorizes signing key     | WORKING (CLI)      | EIP-712 viem script  |
| 4   | Publisher creates a release manifest        | WORKING (CLI)      | @lucentra/core CLI   |
| 5   | Manifest is cryptographically signed        | WORKING (CLI)      | EIP-712 secp256k1    |
| 6   | Release is registered and attested on-chain | WORKING            | Anvil / EAS Contract |
| 7   | Visitor opens the protected website         | WORKING            | Static Web Server    |
| 8   | Extension observes declared JS resources    | WORKING            | Content Script DOM   |
| 9   | Extension retrieves & verifies evidence     | WORKING            | Out-of-band Fetcher  |
| 10  | User receives appropriate verification state| WORKING            | Extension Popup UI   |
| 11  | Gemini explains evidence in plain English   | NOT IMPLEMENTED    | Pending Sprint 5 API |
+-----+---------------------------------------------+--------------------+----------------------+
```

### Detailed Step Analysis:

#### Step 1: Publisher Registers a Domain
- **Status:** **WORKING (MANUAL API / CLI).**
- **Evidence:** `POST /api/v1/domains/challenges/` accepts `{ domain: "example.com", publisher_wallet: "0x..." }`, returns a random verification token, and creates a pending domain record.
- **Limitation:** Requires terminal curl or REST client because the Next.js Publisher Dashboard UI (`apps/dashboard/`) is not yet implemented.

#### Step 2: Domain Ownership Validated Through DNS TXT
- **Status:** **WORKING.**
- **Evidence:** `POST /api/v1/domains/verify-dns/` queries `_lucentra-verification.<domain>` using `dnspython`. In automated tests, mock DNS responses transition the record to `DNS_VERIFIED`.
- **Limitation:** In live local testing without public DNS, requires modifying `services/backend/config/settings.py` or mocking the DNS resolver.

#### Step 3: Publisher Wallet Authorizes a Signing Key
- **Status:** **WORKING (CLI).**
- **Evidence:** Implemented per ADR-011. The publisher generates an EIP-712 `RegistrationAuthorization` intent signature binding domain, wallet, registrar, nonce, and deadline. Verified via `packages/core/src/signature.ts` and `PublisherRegistry.sol`.

#### Step 4: Publisher Creates a Release Manifest
- **Status:** **WORKING (CLI / CODE).**
- **Evidence:** `validateReleaseManifest()` in `@lucentra/core` validates `LUCENTRA-Manifest-v0.1` format, calculates RFC 8785 canonical hashes, and formats resource digests.

#### Step 5: Manifest is Cryptographically Signed
- **Status:** **WORKING (CLI).**
- **Evidence:** `signReleaseManifestWithAccount()` computes the EIP-712 domain separator and struct hash, producing a valid 65-byte ECDSA signature.

#### Step 6: Release is Registered and Attested
- **Status:** **WORKING.**
- **Evidence:** `POST /api/v1/releases/` ingests the signed manifest. The backend calls `EAS.attest()` via `client.py` subprocess bridge, obtaining an on-chain attestation UID.

#### Step 7: Visitor Opens the Website
- **Status:** **WORKING.**
- **Evidence:** A static HTTP server (e.g., Python `http.server` or Node `http`) serves `index.html` loading declared script tags (`/app.js`).

#### Step 8: Chrome Extension Observes Declared JavaScript Resources
- **Status:** **WORKING.**
- **Evidence:** `apps/extension/src/content/index.ts` catalogs external script elements, records normalized URLs, and flags any inline scripts.

#### Step 9: Extension Retrieves & Verifies Evidence
- **Status:** **WORKING.**
- **Evidence:** `ResourceFetcher` retrieves script bytes out-of-band using `redirect: "error"`, streams chunks, computes SHA-256 digests, and queries the backend verification-status API.

#### Step 10: User Receives Verification State
- **Status:** **WORKING.**
- **Evidence:** Extension evaluates the 6-state protocol matrix and updates the popup UI:
  - Green `VERIFIED_RELEASE_MATCH` if all resources match.
  - Red `UNVERIFIED_RESOURCE_DETECTED` if a byte is modified or an undeclared script is found.
  - Amber caution banner if unhashed inline scripts are detected.

#### Step 11: Gemini Explains Evidence in Plain English
- **Status:** **NOT IMPLEMENTED (0%).**
- **Evidence:** No Gemini SDK integration exists in `services/backend` or `apps/extension`. The popup currently displays static explanation text from `constants.ts`.
- **Requirement:** Must be implemented in Sprint 5.

---

## 3. How to Run the Working End-to-End Demo Today

To execute the working end-to-end verification flow today, follow these multi-step terminal procedures:

### Terminal 1: Launch Local Anvil Blockchain
```powershell
.\.bin\anvil.exe --port 8545 --chain-id 31337
```

### Terminal 2: Deploy Smart Contracts
```powershell
.\.bin\forge.exe script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

### Terminal 3: Start Django Backend
```powershell
python services/backend/manage.py migrate --settings=config.settings
python services/backend/manage.py runserver 127.0.0.1:8000 --settings=config.settings
```

### Terminal 4: Build Chrome Extension & Serve Demo Website
```powershell
# 1. Build extension
npm.cmd --prefix apps/extension run build

# 2. Serve demo website on port 3000
python -m http.server 3000 --directory apps/extension/tests/fixtures/demo-site
```

### Terminal 5: Open Browser with Unpacked Extension
1. Open Edge or Chrome.
2. Navigate to `edge://extensions` or `chrome://extensions`.
3. Enable **Developer Mode**.
4. Click **Load Unpacked** and select `C:\Users\mustafa\Desktop\LUCENTRA\apps\extension\dist`.
5. Open `http://localhost:3000/`.
6. Click the LUCENTRA extension icon to view real-time verification evidence.

---

## 4. Minimum Work Required for a Flawless Hackathon Demo

To transform this multi-terminal procedure into a frictionless, 2-minute demo:

1. **One-Click Orchestrator Script (`scripts/demo-e2e.ps1`):**
   - Automatically launches background Anvil, deploys contracts, starts Django, launches local web server, and opens the browser with the extension pre-loaded.
2. **Publisher Dashboard UI (`apps/dashboard/`):**
   - A single Next.js page allowing a judge to connect MetaMask, click "Register Domain", click "Sign Release", and watch the on-chain attestation appear in real time.
3. **Gemini Explainer API Endpoint:**
   - A backend endpoint using `gemini-3.8-flash` that populates a "Gemini AI Security Insights" card in the extension popup.
4. **Tamper Demonstration Switch:**
   - A button on the demo site that injects an altered JavaScript payload (simulating a Magecart attack) to demonstrate the extension instantly flipping from a Green `VERIFIED` state to a Red `UNVERIFIED_RESOURCE_DETECTED` alert with Gemini explaining the exact modified lines.

---

## 5. Demo Readiness Verdict

**PARTIALLY COMPLETE (STRONG PROTOCOL DEMO / UI POLISH NEEDED)**

The underlying verification pipeline works end to end. With a simple Next.js dashboard UI and a Gemini explanation card in Sprint 5, LUCENTRA will deliver an unforgettable live product demonstration.

