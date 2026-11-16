# LUCENTRA Chrome Extension Installation Guide

**Document ID:** LUC-EXT-002  
**Version:** 0.1.0  
**Status:** APPROVED  
**Audience:** Developers, Security Auditors, and Early Adopters  
**Last Updated:** 2026-11-16  

---

## 1. Prerequisites

Before installing the LUCENTRA Chrome Extension, ensure you have:

- Google Chrome, Brave, Chromium, or Microsoft Edge (version 114 or higher supporting Manifest V3 ES module service workers).
- Node.js v20+ or v24+.
- Local development stack (optional for local testing):
  - Local Anvil blockchain running on `http://127.0.0.1:8545` (Chain ID 31337).
  - LUCENTRA Django backend running on `http://127.0.0.1:8000`.

---

## 2. Building the Extension

The extension must be compiled from source using the production build script:

```bash
# 1. Navigate to the extension workspace
cd apps/extension

# 2. Install dependencies (if not already installed)
npm install

# 3. Compile the production bundles
npm run build
```

This generates the self-contained unpacked extension inside `apps/extension/dist/`:

```
apps/extension/dist/
├── manifest.json       # Manifest V3 configuration
├── background.js       # Bundled ES Module Background Service Worker
├── content.js          # Bundled IIFE Content Script
├── popup.html          # Popup Interface HTML
├── popup.css           # High-contrast Dark Theme CSS
├── popup.js            # Bundled Popup Controller
└── icons/              # Generated high-resolution icons (16px, 48px, 128px)
```

---

## 3. Loading the Unpacked Extension in Chrome

1. Open Google Chrome (or any Chromium-based browser).
2. In the URL address bar, navigate to:  
   `chrome://extensions/`
3. In the top-right corner, enable the **Developer mode** toggle.
4. Click the **Load unpacked** button in the top-left toolbar.
5. In the file picker dialog, select the distribution directory:  
   `C:\Users\<username>\Desktop\LUCENTRA\apps\extension\dist`
6. The extension card **LUCENTRA — Trust, made verifiable.** will now appear in your extensions manager with version `0.1.0`.
7. Click the Extensions (puzzle piece) icon in your browser toolbar and pin **LUCENTRA** for direct access.

---

## 4. Connecting to Local Development Services

By default, the extension is pre-configured to communicate with:
- **Backend API:** `http://127.0.0.1:8000`
- **Blockchain RPC:** `http://127.0.0.1:8545`

### Starting the Local Stack
To test live verification flows against the local Anvil testnet and Django REST Framework:

```powershell
# Terminal 1: Launch Anvil Local Blockchain
.\.bin\anvil.exe --port 8545 --chain-id 31337 --block-time 1

# Terminal 2: Run Django Backend
python services/backend/manage.py runserver 127.0.0.1:8000
```

---

## 5. Verification Badge Indicators

When browsing, the LUCENTRA toolbar icon displays real-time cryptographic status badges:

| Badge | Color | Meaning |
| :---: | :---: | :--- |
| `✓` | **Green** | **Cryptographically Verified Release:** Publisher registered, signature verified, on-chain EAS attestation confirmed, 100% of declared scripts match byte-for-byte. |
| `!` | **Red** | **Unverified Resource Detected:** An undeclared script or altered byte digest was detected in the active page DOM. |
| `?` | **Amber** | **Indeterminate:** Incomplete observation (partial script load), network timeout, or offline backend. |
| `✕` | **Crimson** | **Revoked Release:** Attestation has been explicitly revoked on-chain. |
| `○` | **Gray** | **Unregistered Domain:** Domain has not registered an identity on the LUCENTRA protocol. |
| `△` | **Dark Amber** | **Unattested Release:** Valid publisher signature, but no matching on-chain EAS attestation found. |

---

## 6. Running the Automated Test Suite

To verify all extension unit, cryptographic, and security regression tests:

```bash
cd apps/extension
npm test
```

Expected output:
```
✔ ApiClient: normalizes baseUrl trailing slashes
✔ ApiClient: gets health and handles successful responses
✔ ApiClient: returns null on 404 for missing domain verification status
✔ COMPLETENESS INVARIANT: Full observation yields VERIFIED_RELEASE_MATCH
✔ COMPLETENESS INVARIANT: Partial observation MUST NOT yield VERIFIED_RELEASE_MATCH (strictly INDETERMINATE)
✔ COMPLETENESS INVARIANT: Resource retrieval failure yields INDETERMINATE
✔ TAMPER RESISTANCE: Undeclared script in DOM yields UNVERIFIED_RESOURCE_DETECTED
✔ TAMPER RESISTANCE: Altered script content yields UNVERIFIED_RESOURCE_DETECTED
✔ IDENTITY INTEGRITY: Unauthorized or unregistered publisher yields UNREGISTERED_PUBLISHER
✔ REVOCATION: Revoked release yields REVOKED_RELEASE
✔ Crypto Utils: computeSha256Hex matches known SHA-256 test vectors
✔ Crypto Utils: computeResourceHash formats with sha256: prefix
✔ Message Guards: validates valid extension message types
✔ Message Guards: rejects malformed, null, or untyped messages
✔ MessageRouter: handles PING message with PONG
✔ MessageRouter: handles GET_CONFIG and UPDATE_CONFIG
✔ DOM Scanner: catalogs external script tags and flags inline scripts
✔ ResourceFetcher: blocks inline scripts from out-of-band fetching
✔ ResourceFetcher: blocks non-web schemes
✔ ResourceFetcher: blocks SSRF private addresses
✔ ResourceFetcher: fetches and hashes valid script bytes from HTTP server
✔ ResourceFetcher: enforces max byte size limit
✔ URL Utils: isWebScheme verifies valid HTTP and HTTPS protocols
✔ URL Utils: extractDomainFromUrl normalizes domains properly
✔ URL Utils: resolveResourcePath resolves relative and absolute script paths
✔ SSRF Prevention: blocks private IP ranges and cloud metadata
✔ VerifierEngine: returns INDETERMINATE for non-web URL schemes
✔ VerifierEngine: executes full verification against mock backend and web server
ℹ tests 28
ℹ pass 28
ℹ fail 0
```
