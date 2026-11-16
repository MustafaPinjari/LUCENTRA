# LUCENTRA Chrome Extension: Privacy & Security Model

**Document ID:** LUC-EXT-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Classification:** Security Architecture & Privacy Policy  
**Last Updated:** 2026-11-16  

---

## 1. Core Operating Principles

LUCENTRA operates as an independent, transparent, and non-custodial verification client. The extension is engineered under the principle of **Zero Trust toward the client environment and Zero Trust toward central intermediaries**.

```
"Integrity does not imply safety. Provenance does not imply benign intent."
— LUCENTRA Protocol Invariant
```

---

## 2. Privacy Guarantees

### 2.1 Zero Browsing History Tracking
- The extension does **not** collect, record, or transmit user browsing history, search queries, or form inputs.
- Verification queries to the LUCENTRA backend are initiated exclusively for the fully-qualified domain name (FQDN) of the currently active tab. Full URL paths, query parameters, and session fragments are **never** transmitted to the backend.

### 2.2 Ephemeral In-Memory State
- Page inspection data and script observation events are cached strictly in ephemeral session memory (`chrome.storage.local`).
- Tab state is immediately purged upon tab closure (`chrome.tabs.onRemoved`) or navigation to an alternative URL (`chrome.tabs.onUpdated`).

### 2.3 Zero Third-Party Analytics & Telemetry
- The extension contains zero tracking pixels, telemetry probes, Google Analytics tags, or external advertising SDKs.
- All network interactions occur directly with the configured LUCENTRA API endpoint or EVM blockchain node.

---

## 3. Threat Model & Sandbox Boundaries

### 3.1 Browser Execution Limitations (Honest Disclosure)
The extension operates within the Chrome Manifest V3 extension sandbox:

1. **Out-of-Band Fetched Bytes vs. In-Memory V8 JIT Execution:**  
   The extension fetches declared JavaScript assets out-of-band using standard HTTP `fetch()` requests and hashes raw byte arrays via `crypto.subtle.digest`. It verifies that the bytes delivered across the network match the publisher's cryptographically signed manifest.  
   **The extension does not inspect, disassemble, or verify exact in-memory JIT bytes executed inside the browser's V8 JavaScript engine.**
2. **Integrity vs. Safety Distinction:**  
   A `VERIFIED_RELEASE_MATCH` status confirms that the JavaScript loaded on the page was published by the authorized owner of the domain and matches an on-chain EAS attestation. **It does not prove that the code is free from bugs, vulnerabilities, tracking scripts, or malicious developer behavior.**

### 3.2 Server-Side Request Forgery (SSRF) and Private Network Protections
The out-of-band resource fetcher implements strict network boundary enforcement:

- **Private IPv4 Blocking:** Requests to RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and carrier-grade NAT are blocked.
- **Cloud Metadata Defense:** Requests to link-local cloud metadata endpoints (`169.254.169.254`) are unconditionally blocked under all configurations.
- **Localhost Guard:** Localhost (`127.0.0.1`, `localhost`) is permitted strictly when explicitly enabled for development mode (`allowLocalhost: true`).

### 3.3 Resource Exhaustion & Denial-of-Service Defense
- **Per-Asset Size Cap:** Script fetching enforces a strict boundary of **5 MiB (5,242,880 bytes)**. Responses declaring or transmitting larger byte counts are aborted immediately with `OVERSIZE` status.
- **Network Timeouts:** All fetch requests are bound by a 10-second timeout managed via `AbortController`.
- **MutationObserver Throttling:** Script discovery events in the content script are debounced (400ms) to prevent IPC flooding on high-frequency script injection attacks.

### 3.4 Content Security Policy (CSP) & DOM Injection Prevention
- Strict Manifest V3 CSP: `script-src 'self'; object-src 'self'`.
- Zero usage of `eval()`, `new Function()`, or dynamic script tag injection.
- UI DOM rendering uses strict `textContent` and structured `createElement` methods; raw `innerHTML` injection of untrusted variables is prohibited.

---

## 4. Cryptographic Standards Used

| Component | Standard | Purpose |
| :--- | :--- | :--- |
| **Manifest Hashing** | SHA-256 (FIPS 180-4) | Digest calculation of RFC 8785 canonical manifest JSON |
| **Resource Hashing** | SHA-256 (Web Crypto SubtleCrypto) | Out-of-band fetched byte verification |
| **Signature Recovery** | secp256k1 ECDSA | EIP-712 structured data signature verification |
| **On-Chain Evidence** | Ethereum Attestation Service (EAS) | Decentralized attestation validity and revocation tracking |
