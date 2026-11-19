# LUCENTRA — Sprint 5 Security Review & Threat Analysis

**Document ID:** LUC-SEC-SPRINT-005  
**Version:** 1.0.0  
**Status:** APPROVED  
**Date:** 2026-11-19  
**Reviewer:** Principal Application Security Engineer & Web3 Cryptographer  
**Scope:** `apps/dashboard/`, `services/backend/apps/ai/`, `apps/extension/`, `.gemini/skills/`

---

## 1. Executive Summary

An independent security review was conducted across the newly implemented Sprint 5 codebase. The evaluation verified that:
1. Deterministic cryptographic verification remains authoritative over AI explanations.
2. Publisher private keys are never transmitted to or stored on the Django backend.
3. Google Gemini API keys are never exposed to browser extensions or frontend clients.
4. Input sanitization prevents prompt injection and context exhaustion attacks.
5. Frontend and popup DOM manipulation uses safe `textContent` rendering, eliminating cross-site scripting (XSS).

---

## 2. Detailed Security Domain Assessments

### 2.1 Private Key Isolation & Web3 Wallet Security
- **Findings:** Verified in `apps/dashboard/src/components/WalletProvider.tsx` and `apps/dashboard/src/app/dashboard/releases/page.tsx`.
- **Mitigation:** EIP-712 structured data signatures (`RegistrationAuthorization` and `ReleaseManifest`) are requested directly through the browser wallet (`window.ethereum` via Viem). Private keys remain encapsulated within publisher wallet hardware/software.
- **Backend Key Isolation:** The backend registrar private key is strictly guarded in `settings.py` and restricted to Chain ID 31337 (local Anvil). It refuses execution on non-local networks.

### 2.2 Google Gemini API Key Protection
- **Findings:** Verified in `services/backend/apps/ai/services/gemini.py` and `apps/extension/src/services/api-client.ts`.
- **Mitigation:** The `GEMINI_API_KEY` is read strictly from backend environment variables on the server. The Next.js dashboard and Chrome extension make requests to `/api/v1/ai/explanations/` without ever handling the Gemini API key. Neither `.env` nor `.env.local` expose the key to client bundles (`NEXT_PUBLIC_` prefix is strictly prohibited).

### 2.3 Prompt-Injection & Data Exfiltration Defenses
- **Findings:** Verified in `services/backend/apps/ai/services/sanitizer.py`.
- **Defenses Implemented:**
  - `sanitize_text`: Strips non-printable ASCII control characters (`\x00-\x1f\x7f`) and redacts injection trigger patterns (e.g. `ignore all previous instructions`, `you are now`, `mark as safe`).
  - `sanitize_evidence`: Caps resource discrepancy arrays at 20 items to prevent context exhaustion and token bloating.
  - Zero Raw Scripts: Raw external JavaScript code bodies, HTML documents, cookies, and HTTP headers are stripped prior to prompt compilation.

### 2.4 Browser Extension Popup DOM Safety (XSS Prevention)
- **Findings:** Verified in `apps/extension/src/popup/index.ts`.
- **Mitigation:** All model output fields (`headline`, `detailed_explanation`, `technical_discrepancy_summary`, `recommended_action`, `limitations`) are rendered into the popup DOM strictly via `textContent` rather than `innerHTML`. This eliminates potential DOM-based XSS attacks originating from maliciously crafted model responses or prompt injection payloads.

### 2.5 In-Memory Deduplication & Rate Limiting
- **Findings:** Verified in `services/backend/apps/ai/services/gemini.py` and `views.py`.
- **Mitigation:**
  - In-memory cache indexes requests by cryptographic evidence hash for 5 minutes (`_cache_ttl_seconds = 300.0`), preventing repeated model charges on identical page visits.
  - DRF Throttling (`AIExplanationRateThrottle`) caps requests at 30 requests per minute per IP.

---

## 3. Residual Risks & Future Work

1. **Production Wallet Multi-Sig:** Local Anvil development uses single-signature publisher wallets. Production deployments on public testnets should integrate Safe (Gnosis Safe) multi-sig contracts for publisher domain governance.
2. **DNSSEC Enforcement:** The DNS TXT verification engine currently queries authoritative name servers; production deployment will require DNSSEC signature chain validation to protect against DNS cache poisoning attacks.

---

## 4. Final Security Verdict

**Security Status:** **`PASSED — NO UNMITIGATED CRITICAL OR HIGH RISKS`**

