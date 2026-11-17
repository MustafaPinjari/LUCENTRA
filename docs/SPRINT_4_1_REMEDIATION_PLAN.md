# Sprint 4.1 Security Remediation & Hardening Plan

**Document ID:** LUC-SEC-004-1-REM  
**Version:** 1.0.0  
**Classification:** Remediation Engineering Roadmap  
**Target Git Commit:** `f5d3a97`  
**Author:** Principal Security Architect & Browser Security Lead  
**Date:** 2026-11-17  

---

## 1. Overview & Remediation Schedule

This engineering remediation plan defines the exact technical fixes required to transition the LUCENTRA Chrome Extension from **CONDITIONALLY APPROVED** to fully **APPROVED**.

| Priority | Finding ID | Severity | Component | Target Milestone | Effort |
| :---: | :--- | :---: | :--- | :---: | :---: |
| **P0** | **LUC-SEC-041-01** | **HIGH** | Open HTTP Redirect SSRF Defense | Sprint 4.2 | 1 Day |
| **P0** | **LUC-SEC-041-02** | **HIGH** | IPv4-Mapped IPv6 Subnet Filtering | Sprint 4.2 | 0.5 Day |
| **P1** | **LUC-SEC-041-03** | **MEDIUM** | Tab Navigation Race Condition Prevention | Sprint 4.2 | 0.5 Day |
| **P1** | **LUC-SEC-041-04** | **MEDIUM** | Streaming Chunked Size Boundary Enforcement | Sprint 4.2 | 1 Day |
| **P1** | **LUC-SEC-041-05** | **MEDIUM** | Dynamic Verifying Contract Address Binding | Sprint 4.2 | 0.5 Day |
| **P2** | **LUC-SEC-041-06** | **LOW** | Injected Inline Script UI Caution Flag | Sprint 4.2 | 0.5 Day |

---

## 2. Technical Remediation Specifications

### 2.1 Remediation for LUC-SEC-041-01: Open Redirect SSRF Defense
- **Target File:** `apps/extension/src/services/resource-fetcher.ts`
- **Objective:** Prevent `fetch()` from following redirects to internal IP addresses or cloud metadata endpoints.
- **Implementation Strategy:**
  1. Inspect `response.redirected` after the initial fetch, or configure `redirect: "manual"` to handle redirects hop-by-hop.
  2. If `response.redirected` is true, validate `response.url`:
     ```typescript
     if (response.redirected) {
       const finalUrl = new URL(response.url);
       if (isPrivateOrBlockedHost(finalUrl.hostname, this.allowLocalhost)) {
         return {
           path: script.path,
           url: script.normalizedUrl,
           digest: "",
           byteLength: 0,
           fetchedAt,
           status: "BLOCKED",
           errorMessage: `Redirect to private or blocked host '${finalUrl.hostname}' is prohibited`,
         };
       }
     }
     ```
- **Acceptance Test:** Test server with `302 Found` to `169.254.169.254` returns `status: "BLOCKED"`.

---

### 2.2 Remediation for LUC-SEC-041-02: IPv4-Mapped IPv6 Subnet Filtering
- **Target File:** `apps/extension/src/utils/url.ts`
- **Objective:** Detect and block IPv4-mapped IPv6 addresses (`[::ffff:a.b.c.d]` and `[::ffff:hex:hex]`).
- **Implementation Strategy:**
  Extend `isPrivateOrBlockedHost()` to decode IPv4-mapped IPv6 formats:
  ```typescript
  if (host.startsWith("[") && host.endsWith("]")) {
    const rawIpv6 = host.slice(1, -1).toLowerCase();

    // Handle IPv4-mapped IPv6: ::ffff:w.x.y.z or ::ffff:hex:hex
    if (rawIpv6.startsWith("::ffff:")) {
      const remainder = rawIpv6.slice(7);
      let ipv4Str = remainder;

      // Handle hex format: ::ffff:7f00:1 or ::ffff:a9fe:a9fe
      if (remainder.includes(":")) {
        const parts = remainder.split(":");
        if (parts.length === 2) {
          const high = parseInt(parts[0], 16);
          const low = parseInt(parts[1], 16);
          ipv4Str = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        }
      }

      // Recursively evaluate the extracted IPv4 address
      return isPrivateOrBlockedHost(ipv4Str, allowLocalhost);
    }
  }
  ```
- **Acceptance Test:** `isPrivateOrBlockedHost("[::ffff:169.254.169.254]")` and `isPrivateOrBlockedHost("[::ffff:a9fe:a9fe]")` both return `true`.

---

### 2.3 Remediation for LUC-SEC-041-03: Tab Navigation Race Condition Prevention
- **Target Files:** `apps/extension/src/background/message-router.ts` & `service-worker.ts`
- **Objective:** Prevent stale asynchronous verifications from overwriting newer tab verification states.
- **Implementation Strategy:**
  1. Add a monotonic `sessionCounter` map: `tabSessions = new Map<number, number>()`.
  2. When verification starts for a tab, increment and capture `const sessionId = ++counter`.
  3. When `chrome.tabs.onUpdated` triggers for navigation, increment the session counter to invalidate in-flight jobs.
  4. Immediately before `saveTabVerificationState()` and `badgeController.updateBadge()`, verify:
     ```typescript
     if (this.tabSessions.get(tabId) !== currentSessionId) {
       // Tab navigated during verification; drop stale result
       return staleResult;
     }
     ```
- **Acceptance Test:** Simulate an async delay on Tab $T$; trigger navigation on Tab $T$; confirm that Tab $T$'s state does not revert to the initial URL.

---

### 2.4 Remediation for LUC-SEC-041-04: Streaming Chunked Size Boundary Enforcement
- **Target File:** `apps/extension/src/services/resource-fetcher.ts`
- **Objective:** Abort chunked responses immediately when accumulated bytes exceed `maxByteSize` without buffering the complete stream in memory.
- **Implementation Strategy:**
  ```typescript
  if (!response.body) {
    throw new Error("Response body is empty or unavailable");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > this.maxByteSize) {
      await reader.cancel("Resource size exceeded maximum limit");
      return {
        path: script.path,
        url: script.normalizedUrl,
        digest: "",
        byteLength: totalBytes,
        fetchedAt,
        status: "OVERSIZE",
        errorMessage: `Resource stream exceeded maximum limit of ${this.maxByteSize} bytes`,
      };
    }
    chunks.push(value);
  }

  // Concatenate chunks and hash
  const arrayBuffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    arrayBuffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  ```
- **Acceptance Test:** Chunked server stream of 15 chunks (1500 bytes) with `maxByteSize = 500` cancels after reading 5 chunks ($\le 600$ bytes).

---

### 2.5 Remediation for LUC-SEC-041-05: Dynamic Verifying Contract Address Binding
- **Target Files:** `apps/extension/src/types/config.ts` & `verifier-engine.ts`
- **Objective:** Bind the real deployed `verifyingContract` address during EIP-712 signature verification.
- **Implementation Strategy:**
  1. Add `verifyingContractAddress?: Address` to `ExtensionConfig`.
  2. In `verifier-engine.ts`, extract the verifying contract from `domainStatus.onchain_info?.verifyingContract` or fallback to `this.config.publisherRegistryAddress || DEFAULT_VERIFYING_CONTRACT`.
  3. Pass the resolved address into `verifyRelease({ ..., verifyingContract })`.
- **Acceptance Test:** Verifying an Anvil-attested release signed with `0xDc64...` succeeds without domain separator mismatch.

---

### 2.6 Remediation for LUC-SEC-041-06: Injected Inline Script Caution Flag
- **Target Files:** `apps/extension/src/types/verification.ts`, `verifier-engine.ts`, and `popup/index.ts`
- **Objective:** Surface a clear caution flag if unverified inline `<script>` tags are observed in the DOM.
- **Implementation Strategy:**
  1. Add `hasInlineScripts: boolean` to `TabVerificationState`.
  2. In `verifier-engine.ts`:
     ```typescript
     const hasInlineScripts = discoveredScripts.some((s) => s.isInline);
     ```
  3. In `popup/index.ts`, if `state.hasInlineScripts` is true, render an amber advisory badge:  
     `⚠️ Inline scripts detected on page (external bundles verified)`.
- **Acceptance Test:** Page with 1 external script and 1 inline script displays verified status with inline script warning.

---

## 3. Verification & Acceptance Criteria for Sprint 4.2 Sign-Off

Sprint 4.2 will be transitioned to **APPROVED** once:
1. All 6 remediation specifications are implemented in source code.
2. All regression tests in `apps/extension/tests/` and new remediation test cases pass with exit code 0.
3. Zero High or Medium severity vulnerabilities remain in the independent security audit matrix.
