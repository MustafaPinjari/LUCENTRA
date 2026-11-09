# Extension Verification Workflow — LUCENTRA

**Document ID:** LUC-EXT-008  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document outlines the complete step-by-step verification workflow executed by the Chrome Extension on every browser page load.

---

## 2. Complete Verification Workflow

```mermaid
flowchart TD
    A[Tab Navigates to Target URL] --> B[Normalize Domain UTS #46]
    B --> C{Domain Cached in chrome.storage.local?}
    C -- Yes --> D[Load Cached Manifest & EAS Attestation]
    C -- No --> E[Query Backend API: GET /api/v1/domains/{domain}/manifest/active/]
    
    E --> F{Status 200?}
    F -- No: 404 --> G[Set Status: UNREGISTERED - Gray Badge]
    F -- Yes --> H[Verify EAS Attestation UID on EVM RPC]
    
    H --> I{Is Publisher Key Valid & Unrevoked?}
    I -- No --> J[Set Status: REVOKED - Red Alert Badge]
    I -- Yes --> K[Store Manifest in Local Cache]
    
    D --> L[Inspect DOM Scripts via Content Script]
    K --> L
    L --> M[Fetch Script Bytes & Compute SHA-256 via Web Worker]
    M --> N{Does each script SHA-256 match manifest.resources?}
    
    N -- Match All --> O[Set Status: VERIFIED - Green Shield Badge]
    N -- Mismatch or Unknown Script --> P[Set Status: MISMATCH - Red Flashing Alert]
```

---

## 3. Related Documents

- [docs/04-protocol/VERIFICATION_STATES.md](../04-protocol/VERIFICATION_STATES.md)
- [docs/09-browser-extension/SERVICE_WORKER.md](SERVICE_WORKER.md)

---

## 4. References

- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)

