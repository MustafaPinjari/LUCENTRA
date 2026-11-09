# Browser Limitations & Manifest V3 Constraints — LUCENTRA

**Document ID:** LUC-EXT-009  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document documents the technical constraints, browser security sandboxes, and edge cases inherent to browser extensions under Chrome Manifest V3, outlining LUCENTRA's architectural accommodations.

---

## 2. Identified Browser Constraints & Solutions

### 2.1 Absence of Synchronous Network Interception
- **Limitation:** In Manifest V3, `chrome.webRequest` cannot synchronously block network requests in consumer extensions. Scripts may begin parsing as they stream in.
- **Accommodation:** The extension injects content scripts at `document_start` and attaches a synchronous `MutationObserver`. Script hashes are computed concurrently. If a hash mismatch is detected, the extension surfaces a prominent security alert badge and popup warning the user before credentials or wallet transactions are submitted.

### 2.2 Cross-Origin Resource Sharing (CORS) on Script Fetches
- **Limitation:** Content scripts executing in page context are restricted by the target site's CORS policies when attempting to `fetch()` third-party scripts.
- **Accommodation:** When a cross-origin script is encountered, the content script passes the URL to the background service worker, which performs the fetch under privileged extension host permissions.

### 2.3 Ephemeral Service Worker Termination
- **Limitation:** MV3 service workers terminate after 30 seconds of inactivity. In-memory global variables are cleared.
- **Accommodation:** All manifest state, EAS verification receipts, and tab status mappings are serialized and persisted in `chrome.storage.local`.

---

## 3. Related Documents

- [docs/09-browser-extension/EXTENSION_ARCHITECTURE.md](EXTENSION_ARCHITECTURE.md)
- [docs/09-browser-extension/MANIFEST_V3.md](MANIFEST_V3.md)

---

## 4. References

- [Chrome Extensions MV3 Overview and Known Issues](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/)
