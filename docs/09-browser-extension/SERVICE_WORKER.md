# Service Worker & Lifecycle Management (MV3) — LUCENTRA

**Document ID:** LUC-EXT-005  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the background service worker architecture for the Chrome Extension, addressing Manifest V3 event-driven execution, state persistence across termination, and toolbar badging.

---

## 2. Background Service Worker Implementation (`apps/extension/src/background.ts`)

```typescript
// Background Service Worker (Manifest V3)
import { normalizeDomain } from "@lucentra/core";

interface TabVerificationState {
  domain: string;
  manifest: any | null;
  observedScripts: Map<string, { sha256?: string; status: "PENDING" | "MATCH" | "MISMATCH" }>;
  overallStatus: "VERIFIED" | "MISMATCH" | "UNREGISTERED" | "UNATTESTED" | "INDETERMINATE";
}

const activeTabs = new Map<number, TabVerificationState>();

// Handle messages from Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  if (message.type === "LUCENTRA_INIT_PAGE") {
    handlePageInit(tabId, message.payload.domain);
  } else if (message.type === "LUCENTRA_SCRIPT_FOUND") {
    handleScriptFound(tabId, message.payload.src);
  }
});

async function handlePageInit(tabId: number, rawDomain: string) {
  const domain = normalizeDomain(rawDomain);
  
  // Set initial state
  const state: TabVerificationState = {
    domain,
    manifest: null,
    observedScripts: new Map(),
    overallStatus: "INDETERMINATE"
  };
  activeTabs.set(tabId, state);

  // Fetch active release manifest from API / Cache
  try {
    const res = await fetch(`https://api.lucentra.io/api/v1/domains/${domain}/manifest/active/`);
    if (res.status === 404) {
      state.overallStatus = "UNREGISTERED";
      updateBadge(tabId, "UNREGISTERED");
      return;
    }
    const data = await res.json();
    state.manifest = data.manifest;
    state.overallStatus = "VERIFIED"; // tentative until scripts evaluated
    updateBadge(tabId, "VERIFIED");
  } catch (err) {
    state.overallStatus = "INDETERMINATE";
    updateBadge(tabId, "INDETERMINATE");
  }
}

async function handleScriptFound(tabId: number, scriptSrc: string) {
  const state = activeTabs.get(tabId);
  if (!state || !state.manifest) return;

  // Fetch script byte stream in background service worker to avoid content script CORS
  try {
    const resp = await fetch(scriptSrc);
    const buffer = await resp.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashHex = "sha256:" + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    // Compare with manifest
    const urlObj = new URL(scriptSrc);
    const path = urlObj.pathname;

    const matchedResource = state.manifest.resources.find((r: any) => r.path === path && r.sha256 === hashHex);

    if (matchedResource) {
      state.observedScripts.set(scriptSrc, { sha256: hashHex, status: "MATCH" });
    } else {
      state.observedScripts.set(scriptSrc, { sha256: hashHex, status: "MISMATCH" });
      state.overallStatus = "MISMATCH";
      updateBadge(tabId, "MISMATCH");
    }
  } catch (err) {
    // Fetch failed
  }
}

function updateBadge(tabId: number, status: string) {
  if (status === "VERIFIED") {
    chrome.action.setBadgeText({ tabId, text: "✓" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#10b981" }); // Emerald
  } else if (status === "MISMATCH") {
    chrome.action.setBadgeText({ tabId, text: "!" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#f43f5e" }); // Rose
  } else if (status === "UNREGISTERED") {
    chrome.action.setBadgeText({ tabId, text: "" });
  }
}
```

---

## 3. Related Documents

- [docs/09-browser-extension/EXTENSION_ARCHITECTURE.md](EXTENSION_ARCHITECTURE.md)
- [docs/09-browser-extension/RESOURCE_HASHING.md](RESOURCE_HASHING.md)

---

## 4. References

- [Chrome Service Worker Migration](https://developer.chrome.com/docs/extensions/mv3/migrating-to-service-workers/)
