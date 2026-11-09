# Browser Limitations, Verification Boundaries & Honest Claims — LUCENTRA

**Document ID:** LUC-EXT-009  
**Version:** 0.2.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document establishes the formal verification boundaries, browser runtime limitations, and honest security claims of the LUCENTRA Chrome Extension under Chrome Manifest V3. 

It explicitly distinguishes between DOM discovery, out-of-band resource retrieval, cryptographic comparison, and exact browser-executed byte verification.

---

## 2. The Seven Verification Layers (Honest Architectural Breakdown)

The LUCENTRA client verification pipeline is composed of seven distinct layers. Understanding the boundaries between these layers is essential to avoid overstating client security guarantees:

```mermaid
flowchart TD
    L1[Layer 1: DOM Script Discovery<br/>MutationObserver detects script tags in DOM] --> L2[Layer 2: Resource Retrieval<br/>Extension fetches resource byte stream via background worker]
    L2 --> L3[Layer 3: SHA-256 Hashing<br/>Web Worker computes SHA-256 digest of retrieved bytes]
    L3 --> L4[Layer 4: Signed Manifest Verification<br/>Verifies canonical manifest hash and publisher signature]
    L4 --> L5[Layer 5: Publisher Identity Verification<br/>Verifies EAS attestation & PublisherRegistry on-chain]
    L5 --> L6[Layer 6: Resource Integrity Comparison<br/>Cross-checks computed hash against declared manifest hashes]
    L6 -.->|BOUNDARY OF SEPARATION| L7[Layer 7: Exact Browser-Executed Byte Verification<br/>CRITICAL: In-memory V8 execution verification]

    classDef standard fill:#e8f5e9,stroke:#2e7d32;
    classDef boundary fill:#ffebee,stroke:#c62828,stroke-dasharray: 5 5;
    class L1,L2,L3,L4,L5,L6 standard;
    class L7 boundary;
```

### Layer 1: DOM Script Discovery
The content script observes the document and intercepts `<script>` elements as they enter the DOM via `document_start` injection and `MutationObserver`.  
*Limitation:* Does not observe scripts executed via internal browser worker threads or extension-injected code unless attached to the page DOM.

### Layer 2: Resource Retrieval
The background service worker performs an independent HTTP(S) `fetch()` of the script's declared `src` URL using privileged host permissions.  
*Limitation:* **The retrieved byte stream is fetched out-of-band.** The bytes retrieved by the extension's fetch may hit a different CDN edge node, a different caching tier, or a different HTTP response than what the browser's HTML parser fetched for execution.

### Layer 3: SHA-256 Hashing
The retrieved byte stream is processed in a dedicated Web Worker via `crypto.subtle.digest("SHA-256", buffer)`.  
*Guarantee:* Hardware-accelerated, mathematically exact 256-bit cryptographic digest of the retrieved byte buffer.

### Layer 4: Signed Manifest Verification
The manifest JSON is canonicalized using RFC 8785 (JCS) and its SHA-256 root hash is confirmed. The publisher's EIP-712 cryptographic signature over that root hash is verified.

### Layer 5: Publisher Identity Verification
The on-chain EAS attestation UID is queried on Ethereum / Arbitrum RPC to verify that the signer was an authorized signing key for the domain in `PublisherRegistry.sol` at the block timestamp of release.

### Layer 6: Resource Integrity Comparison
The extension compares the computed SHA-256 hash of each retrieved script against the declared hashes in the publisher's signed release manifest.

### Layer 7: Exact Browser-Executed Byte Verification (CRITICAL DISTINCTION)
**The MVP Chrome Extension DOES NOT and CANNOT guarantee Layer 7.**  
Standard Chromium browser extension APIs (Manifest V3) do not expose hooks into the V8 JavaScript engine's internal JIT compiler or in-memory execution pipeline. Therefore, **the MVP must not claim that independently fetched resource bytes are necessarily identical to the exact bytes executed by the browser's execution engine.**

---

## 3. Detailed Browser Constraints & Attack Surfaces

### 3.1 Network Cache & Edge Inconsistencies
When the extension fetches `/static/js/main.js`, the request may receive a different HTTP response than the browser's main parser due to:
- Rolling CDN deployments where edge nodes are desynchronized.
- Cache-Control headers, ETag mismatches, or HTTP 304 Not Modified responses.
- IP-based or session-based server-side split-view attacks.

### 3.2 Service Worker Interception
If the host web application registers a Progressive Web App (PWA) Service Worker, that service worker can intercept `fetch()` events and serve synthesized or cached JavaScript without making network requests. Content script requests must account for service worker scopes.

### 3.3 Dynamic Scripts & Runtime DOM Modifications
Applications may dynamically assemble JavaScript code strings at runtime (`eval()`, `document.write()`, `Blob` URLs). The MVP strictly verifies declared static and dynamic external script files; it cannot statically verify arbitrary in-memory eval assembly without enterprise-level browser instrumentation.

### 3.4 Inline Scripts
Inline scripts (`<script>/* code */</script>`) have no `src` attribute. While their textual content can be hashed from `textContent`, minor whitespace variations or dynamic server-side template variables can alter the hash between requests. Inline scripts are audited and flagged, but full integrity guarantees apply primarily to external versioned bundles.

### 3.5 Cross-Origin Resource Sharing (CORS) & Redirects
Content scripts attempting to fetch cross-origin resources directly are blocked by CORS. The extension routes all resource retrieval through the background service worker using extension host permissions. If a script URL triggers an HTTP 301/302 redirect, the final resolved URL and response must be recorded and evaluated.

### 3.6 Timing & Pre-Execution Race Conditions
Because Manifest V3 does not support synchronous `webRequestBlocking` for consumer extensions, an external script may begin parsing and executing in the browser before the extension's out-of-band fetch, hash, and on-chain verification complete.  
*Mitigation:* Verification status is surfaced asynchronously; users are cautioned through prominent badging if verification is pending or if a mismatch is detected immediately after load.

---

## 4. Honest Verification States & User-Facing Messaging

To ensure absolute transparency and technical integrity, user-facing verification states are defined with explicit, honest semantics:

| State Identifier | Action Badge | User-Facing Popup Title | Technical Meaning & Honest Boundary |
| :--- | :--- | :--- | :--- |
| **`VERIFIED_RELEASE_MATCH`** | Emerald Green (✓) | **Verified Publisher Release** | All discovered external scripts match the publisher's signed release manifest based on out-of-band resource retrieval and SHA-256 comparison. |
| **`UNVERIFIED_RESOURCE_DETECTED`** | Rose Red (!) | **Unverified Resource Detected** | An executed script's retrieved hash does not match the publisher's signed manifest, or an unauthorized external script URL was loaded into the DOM. |
| **`UNREGISTERED_PUBLISHER`** | Neutral Slate (—) | **Unregistered Domain** | No publisher record found in `PublisherRegistry.sol`. Standard web HTTPS protections apply. |
| **`UNATTESTED_RELEASE`** | Amber Alert (○) | **Unattested Release** | Publisher is registered, but no active EAS release attestation was published for this deployment. |
| **`REVOKED_RELEASE`** | Crimson Alert (🚫) | **Revoked Release / Compromised Key** | The release attestation or publisher signing key has been explicitly revoked on-chain. |
| **`INDETERMINATE`** | Purple Caution (?) | **Verification Incomplete** | Verification could not complete due to network timeout, RPC unavailability, or browser sandbox constraints. |

---

## 5. Related Documents

- [docs/09-browser-extension/EXTENSION_ARCHITECTURE.md](EXTENSION_ARCHITECTURE.md)
- [docs/09-browser-extension/VERIFICATION_WORKFLOW.md](VERIFICATION_WORKFLOW.md)
- [docs/04-protocol/VERIFICATION_STATES.md](../04-protocol/VERIFICATION_STATES.md)
- [docs/11-security/THREAT_MODEL.md](../11-security/THREAT_MODEL.md)

---

## 6. References

- [Chrome Extensions Manifest V3 Overview](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/)
- [W3C Service Workers Specification](https://www.w3.org/TR/service-workers/)
