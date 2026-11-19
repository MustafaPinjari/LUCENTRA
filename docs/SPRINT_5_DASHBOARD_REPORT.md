# LUCENTRA — Sprint 5 Dashboard Report
## Next.js Publisher Dashboard Architecture & Implementation

**Document ID:** LUC-DASH-001  
**Version:** 1.0.0  
**Status:** APPROVED & TESTED  
**Date:** 2026-11-19  
**Component:** `apps/dashboard/`  
**Technology:** Next.js 14 App Router, React 18, TypeScript Strict, Tailwind CSS, Viem 2.10

---

## 1. Executive Summary

The **LUCENTRA Publisher Dashboard** is a cybersecurity SaaS frontend providing website publishers with an intuitive, non-custodial interface to manage domain authorizations, release signing keys, cryptographically signed release manifests, and Ethereum Attestation Service (EAS) records.

The dashboard connects directly to the local Django REST Framework backend (`http://127.0.0.1:8000`) and the local Anvil EVM blockchain (Chain ID 31337) using browser wallets (such as MetaMask or Rabby via Viem).

---

## 2. Page & Route Inventory

All 8 core routes have been implemented with zero mock placeholders:

| Route | Title | Primary Functionality | Working Status |
| :--- | :--- | :--- | :--- |
| **`/dashboard`** | Overview | System status, connectivity indicators, registered domains, active releases, quick actions. | **VERIFIED** |
| **`/dashboard/domains`** | Domain Management | Domain list, status badges, and 4-step Dual-Authorization onboarding wizard. | **VERIFIED** |
| **`/dashboard/identity`** | Publisher Identity | EVM wallet connector, chain validation, on-chain nonce inspection, EIP-712 auth. | **VERIFIED** |
| **`/dashboard/keys`** | Signing Keys | Authorize operational release signing keys, revoke keys on-chain, backend sync. | **VERIFIED** |
| **`/dashboard/releases`** | Release Management | Manifest builder, raw byte file hashing, RFC 8785 canonicalization, EIP-712 signing, EAS attestation. | **VERIFIED** |
| **`/dashboard/verification`** | Verification History | Audit trail of verified releases, resource counts, attestation UIDs, and timestamps. | **VERIFIED** |
| **`/dashboard/insights`** | Security Insights | Interactive Google Gemini copilot explainer, risk level badges, and tamper simulator. | **VERIFIED** |
| **`/dashboard/settings`** | Settings | API endpoint configuration, contract address inspector, privacy disclosures. | **VERIFIED** |

---

## 3. Core Workflows

### 3.1 Domain Onboarding Wizard (Dual-Authorization)
Enforces ADR-011 Dual-Authorization preventing unilateral domain assignments:
1. **Origin Specification:** Publisher enters UTS #46 canonical domain (e.g. `portal.acme-corp.com`) and optional initial signing key.
2. **DNS TXT Challenge:** Frontend calls `POST /api/v1/domains/challenges/` to receive a cryptographically random challenge token and formatted DNS TXT record (`_lucentra-verification.portal.acme-corp.com`).
3. **DNS Validation:** Publisher adds record to their authoritative DNS. Frontend triggers `POST /api/v1/domains/verify-dns/`. The backend performs authoritative name server queries and marks the challenge `DNS_VERIFIED`.
4. **EIP-712 Publisher Authorization:** Publisher wallet signs typed `RegistrationAuthorization` binding domain, publisher address, initial signing key, on-chain nonce, and 1-hour expiration deadline.
5. **On-Chain Relay:** Frontend submits signature to `POST /api/v1/domains/register/`. Backend registrar relays the transaction to `PublisherRegistry.registerPublisherDomainWithAuth(...)`.

### 3.2 Release Creation & RFC 8785 Hashing Wizard
Enforces byte-level resource integrity and monotonic sequence progression:
1. **Target Selection:** Publisher selects registered domain and inputs SemVer version string.
2. **Artifact Hashing:** Publisher either enters resource paths or uploads local build files (e.g. `main.b8f41a.js`). The browser uses the Web Crypto API (`crypto.subtle.digest("SHA-256", buffer)`) to compute raw byte SHA-256 digests formatted as `sha256:<hex>`.
3. **Manifest Construction:** Builds standard protocol manifest conforming to `APPROVED_SCHEMA_VERSION` (`LUCENTRA-Manifest-v0.1`), monotonic sequence number, and previous manifest hash continuity.
4. **Canonicalization (RFC 8785):** Manifest is canonicalized using `@lucentra/core` `canonicalizeManifest` and hashed via `hashManifest`.
5. **EIP-712 Signing:** Connected wallet signs `ReleaseManifest` structured message using `SignatureVerifier.sol` as the verifying contract.
6. **EAS Attestation:** Backend verifies signature, validates resources, and issues on-chain EAS attestation via `ReleaseAttestationVerifier.sol`.

---

## 4. Visual Design & Theme

- **Foundation:** Charcoal and dark navy foundation (`#080C14` / `#0C1220` / `#0F172A`).
- **Accents:** Subtle sky blue and cyan accents (`#0EA5E9` / `#38BDF8`).
- **State Badges:** Emerald green (`#10B981`) for verified states, amber yellow (`#F59E0B`) for warnings/pending DNS, rose red (`#EF4444`) for unverified/revoked states.
- **Typography & Components:** Strict monospace font for addresses and digests; accessible tables with responsive horizontal scrolling.

---

## 5. Build & Typecheck Verification

The dashboard compiles cleanly without warnings:
- `next build`: Successfully generated 12 static pages and app routes. First Load JS shared by all is **87.4 kB**.
- `tsc --noEmit`: Strict TypeScript typecheck passed with **exit code 0**.

