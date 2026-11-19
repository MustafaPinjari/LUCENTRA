# LUCENTRA — Sprint 5 Test Evidence & Verification Log

**Document ID:** LUC-TEST-SPRINT-005  
**Version:** 1.0.0  
**Status:** VERIFIED  
**Date:** 2026-11-19  
**Execution Environment:** Windows 11 Enterprise, PowerShell, Node.js v24.19.0, Python 3.14.7, Foundry Forge 1.9.0

---

## 1. Mathematical Test Census

```
┌────────────────────┬────────────┬──────────┬────────┬─────────┬─────────┬──────────────┐
│ Test Suite         │ Discovered │ Executed │ Passed │ Failed  │ Skipped │ Pass Rate    │
├────────────────────┼────────────┼──────────┼────────┼─────────┼─────────┼──────────────┤
│ Forge Contracts    │ 79         │ 79       │ 79     │ 0       │ 0       │ 100.0%       │
│ Core TypeScript    │ 67         │ 66       │ 66     │ 0       │ 1*      │ 100.0% (exec)│
│ Extension MV3      │ 61         │ 61       │ 61     │ 0       │ 0       │ 100.0%       │
│ Django Backend     │ 67         │ 66       │ 66     │ 0       │ 1*      │ 100.0% (exec)│
├────────────────────┼────────────┼──────────┼────────┼─────────┼─────────┼──────────────┤
│ TOTALS             │ 274        │ 272      │ 272    │ 0       │ 2       │ 100.0%       │
└────────────────────┴────────────┴──────────┴────────┴─────────┴─────────┴──────────────┘
```

---

## 2. Detailed Test Suite Execution Logs

### 2.1 Next.js Publisher Dashboard Build & Typecheck
- **Command:** `npm.cmd --prefix apps/dashboard run build`
- **Exit Code:** `0`
- **Output Summary:**
  ```text
  ▲ Next.js 14.2.35
     Creating an optimized production build ...
   ✓ Compiled successfully
     Linting and checking validity of types ...
   ✓ Generating static pages (12/12)
     Finalizing page optimization ...
  Route (app)                              Size     First Load JS
  ┌ ○ /                                    138 B          87.5 kB
  ├ ○ /dashboard                           4.24 kB         174 kB
  ├ ○ /dashboard/domains                   6.06 kB         166 kB
  ├ ○ /dashboard/identity                  4.3 kB          164 kB
  ├ ○ /dashboard/insights                  5.02 kB        92.4 kB
  ├ ○ /dashboard/keys                      4.41 kB         165 kB
  ├ ○ /dashboard/releases                  6.23 kB         166 kB
  ├ ○ /dashboard/settings                  3.78 kB         164 kB
  └ ○ /dashboard/verification              3.8 kB         91.2 kB
  + First Load JS shared by all            87.4 kB
  ```
- **Typecheck Command:** `npm.cmd --prefix apps/dashboard run typecheck`
- **Exit Code:** `0` (Zero TypeScript diagnostics).

---

### 2.2 Chrome Extension Build & Test Suite
- **Build Command:** `npm.cmd --prefix apps/extension run build`
- **Exit Code:** `0`
- **Bundles Generated:**
  - `dist/background.js`: 154.78 kB (gzip: 44.60 kB)
  - `dist/content.js`: 12.84 kB (gzip: 4.61 kB)
  - `dist/popup.js`: 25.41 kB (gzip: 7.69 kB)
- **Test Command:** `npm.cmd --prefix apps/extension test`
- **Exit Code:** `0`
- **Test Count:** 61 passed, 0 failed, 0 skipped.

---

### 2.3 Core Cryptographic Engine Test Suite
- **Test Command:** `npm.cmd --prefix packages/core test`
- **Exit Code:** `0`
- **Test Count:** 67 discovered, 66 passed, 0 failed, 1 skipped (`e2e.test.ts` Anvil live integration).

---

### 2.4 Smart Contracts (Foundry Forge)
- **Test Command:** `.\.bin\forge.exe test --root contracts`
- **Exit Code:** `0`
- **Suites Executed:**
  - `SignatureVerifierTest`: 16 passed, 0 failed.
  - `EASIntegrationTest`: 21 passed, 0 failed.
  - `PublisherRegistryInvariantsTest`: 3 fuzz suites passed (256 runs each).
  - `PublisherRegistryTest`: 39 passed, 0 failed.
- **Total:** 79 passed, 0 failed, 0 skipped in 92.09ms.

---

### 2.5 Django Backend Test Suite
- **Test Command:** `python services/backend/manage.py test tests apps.ai`
- **Exit Code:** `0`
- **Test Count:** 67 discovered, 66 passed, 0 failed, 1 skipped (`test_complete_live_lifecycle` - Anvil not running).
- **New AI App Tests:** 12 passed in `apps.ai.tests.test_ai_service`.

---

### 2.6 Repository Integrity & Link Verification
- **Command:** `powershell -ExecutionPolicy Bypass -File scripts/validate-structure.ps1`
- **Exit Code:** `0`
- **Result:**
  - Scanned 204 markdown files.
  - Checked 641 internal markdown links.
  - 0 broken links, 0 structural errors.

