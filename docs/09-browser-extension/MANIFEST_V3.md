# Manifest V3 Specification (`manifest.json`) — LUCENTRA

**Document ID:** LUC-EXT-002  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides the complete, production-grade `manifest.json` definition for the LUCENTRA Chrome Extension under Manifest V3.

---

## 2. Manifest V3 Schema (`apps/extension/public/manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "LUCENTRA — Internet Authenticity & Integrity Verifier",
  "version": "0.1.0",
  "description": "Cryptographically verifies website publisher identity and JavaScript resource integrity using Ethereum and EAS.",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/badge-gray-16.png",
      "32": "icons/badge-gray-32.png"
    },
    "default_title": "LUCENTRA Verification"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": false
    }
  ],
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://api.lucentra.io/*",
    "https://*.infura.io/*",
    "https://*.alchemy.com/*",
    "https://sepolia.easscan.org/*"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; default-src 'none'; connect-src 'self' https://api.lucentra.io https://*.infura.io https://*.alchemy.com https://sepolia.easscan.org; img-src 'self' data:; style-src 'self' 'unsafe-inline';"
  }
}
```

---

## 3. Strict CSP Enforcement

- `script-src 'self'`: Disallows external script loading or remote code execution.
- Evaluated functions (`eval()`, `new Function()`) are completely prohibited.

---

## 4. Related Documents

- [docs/09-browser-extension/PERMISSION_MODEL.md](PERMISSION_MODEL.md)
- [docs/09-browser-extension/SERVICE_WORKER.md](SERVICE_WORKER.md)

---

## 5. References

- [Chrome Extensions Manifest File Format](https://developer.chrome.com/docs/extensions/mv3/manifest/)
