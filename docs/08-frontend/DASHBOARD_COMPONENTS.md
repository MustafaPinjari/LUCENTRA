# Dashboard Component Specifications — LUCENTRA

**Document ID:** LUC-FE-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides component hierarchy, prop interfaces, and state flows for the primary views of the Next.js Publisher Dashboard.

---

## 2. Core Dashboard Components

### 2.1 `DomainRegistrationCard`
- **Props:** `domain: string`, `status: "PENDING" | "VERIFIED"`, `challengeValue: string`
- **Behavior:** Renders DNS TXT instructions with one-click copy buttons; displays live polling indicator checking DNS propagation.

### 2.2 `ManifestDropzone`
- **Props:** `onManifestCompiled: (manifest: ReleaseManifest) => void`
- **Behavior:** Accepts web build directory folder upload (`dist/` or `out/`); processes files via HTML5 File System API in-browser; parses JavaScript files, calculates SHA-256 hashes, and populates `ReleaseManifest`.

### 2.3 `EIP712SigningModal`
- **Props:** `manifest: ReleaseManifest`, `isOpen: boolean`, `onSuccess: (sig: string, uid: string) => void`
- **Behavior:** Triggers wallet signing prompt using Viem; submits attestation to EAS contract upon signature receipt; displays live transaction receipt and block explorer link.

---

## 3. Related Documents

- [docs/08-frontend/PUBLISHER_WORKFLOWS.md](PUBLISHER_WORKFLOWS.md)
- [docs/08-frontend/WALLET_INTEGRATION.md](WALLET_INTEGRATION.md)

---

## 4. References

- [React Hook Form](https://react-hook-form.com/)
