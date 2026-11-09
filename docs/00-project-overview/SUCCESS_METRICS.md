# Success Metrics, Benchmarks & Limits — LUCENTRA

**Document ID:** LUC-OVR-006  
**Version:** 0.2.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document establishes the quantitative engineering performance benchmarks, latency budgets, testing sample methodologies, and explicit detection limits for LUCENTRA. 

It explicitly distinguishes between **Proposed Benchmark Targets** and **Empirically Measured Results**.

---

## 2. Explicit Status: Proposed Targets vs. Measured Results

> **STATUS NOTICE:**  
> All numerical figures below represent **PROPOSED ARCHITECTURAL BENCHMARK TARGETS** for Sprint 1 and MVP evaluation. As established in the repository inspection, no production code has been deployed yet. **Zero empirical measured results currently exist in the repository.** Measured results will be recorded upon execution of the automated benchmark suites.

---

## 3. Reference Benchmark Environment & Methodology

To ensure repeatable and statistically rigorous performance evaluations:
- **Reference Hardware:** Standard mid-tier developer workstation:
  - CPU: 8-Core Intel Core i7 / AMD Ryzen 7 / Apple M2.
  - RAM: 16 GB.
  - Network: 100 Mbps symmetrical broadband with $\le 25\text{ ms}$ baseline ping.
- **Reference Browser:** Chromium v124+ (Headless and Headed mode).
- **Test Sample Size:** Minimum 100 sequential page-load iterations per benchmark scenario across 10 diverse public web applications.
- **Target Asset Size Range:** 10 KB (small utility chunks) to 10 MB (large monolithic bundles).

---

## 4. Proposed Performance Targets (Cold vs. Warm Cache)

| Performance Indicator | Cache Scenario | Target p50 Latency | Target p95 Latency | Measurement Method |
| :--- | :--- | :--- | :--- | :--- |
| **Extension Verification Latency** | **Cold Cache** (First visit; API fetch + RPC check) | $\le 250\text{ ms}$ | $\le 600\text{ ms}$ | `performance.now()` in Background Service Worker |
| **Extension Verification Latency** | **Warm Cache** (`chrome.storage.local` hit) | $\le 20\text{ ms}$ | $\le 50\text{ ms}$ | `performance.now()` in Background Service Worker |
| **Web Worker Hashing Throughput** | All scenarios (Per 100 KB script) | $\le 2.0\text{ ms}$ | $\le 5.0\text{ ms}$ | Web Worker `crypto.subtle` performance timer |
| **Backend Manifest API Response** | Server Redis Cache Hit | $\le 15\text{ ms}$ | $\le 35\text{ ms}$ | k6 load test (500 virtual users) |
| **Backend Manifest API Response** | Server Cache Miss (PostgreSQL query) | $\le 45\text{ ms}$ | $\le 80\text{ ms}$ | k6 load test (500 virtual users) |
| **DNS TXT Propagation Check** | Authoritative DNS lookup | $\le 5\text{ s}$ | $\le 20\text{ s}$ | Celery task execution timer |
| **Contract `registerDomain` Gas** | Arbitrum / Sepolia EVM | $\approx 65,000\text{ gas}$ | $\le 75,000\text{ gas}$ | Foundry `forge test --gas-report` |

---

## 5. False-Positive & False-Negative Targets

- **Target False Positive Rate:** $< 0.1\%$ on deterministically compiled web applications where builds and manifests are generated via standard reproducible bundlers.
  - *Known False Positive Edge Cases:* Web applications that append dynamic query parameters or dynamic cache-busting nonces directly inside script file contents at serve-time will trigger false mismatches unless configured as unmanaged or isolated scripts.
- **Target False Negative Rate:** $< 0.01\%$ for unauthorized third-party script tags or modified first-party bundles that alter declared byte content.

---

## 6. Explicit Limits on What the MVP Can Detect

**LUCENTRA does NOT promise universal 100% web tampering detection.** 

The MVP operates within strict architectural and browser sandbox boundaries:

### What the MVP CAN Detect:
1. Discrepancies between the out-of-band retrieved byte hash of a `<script src>` resource and the publisher's signed release manifest.
2. Injections of unauthorized external `<script src="https://evil.com/skimmer.js">` tags inserted into the DOM.
3. Outdated releases running on domains where the publisher's EAS attestation or signing key has been revoked on-chain.
4. Divergent regional bundle deliveries detected across independent witness observer nodes.

### What the MVP CANNOT Detect:
1. **In-Memory DOM Prototype Pollution:** Malicious mutations executed entirely in JavaScript runtime memory after a legitimate script executes (e.g. modifying `Array.prototype` or `window.fetch`).
2. **Browser Engine / Extension Sandbox Compromise:** If the client's browser itself is infected with local malware, an adversary with root OS privileges can bypass extension APIs.
3. **Difference between Retrieved and Executed Bytes:** If a compromised CDN edge worker selectively serves authentic bytes to the extension's `fetch()` request while serving malicious bytes to the browser's script loader (split-connection attack), only independent witness nodes can detect the discrepancy post-hoc.
4. **Arbitrary Dynamic `eval()` Assembly:** In-memory string concats executed via `eval()` or WebAssembly blobs not bound to an external script URL.

---

## 7. Related Documents

- [docs/09-browser-extension/BROWSER_LIMITATIONS.md](../09-browser-extension/BROWSER_LIMITATIONS.md)
- [docs/12-testing/PERFORMANCE_TESTING.md](../12-testing/PERFORMANCE_TESTING.md)
- [docs/14-project-management/DEVELOPMENT_STATUS.md](../14-project-management/DEVELOPMENT_STATUS.md)

---

## 8. References

- [W3C Navigation Timing Level 2](https://www.w3.org/TR/navigation-timing-2/)
- [k6 Performance Testing Documentation](https://k6.io/docs/)
