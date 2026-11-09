# Chrome Extension User Guide — LUCENTRA

**Document ID:** LUC-USR-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This user guide explains how end users install, configure, and interpret security statuses within the LUCENTRA Chrome Extension.

---

## 2. Understanding Verification Badges

The extension runs silently in the background. As you browse, the toolbar icon provides instant security feedback:

| Badge Icon | Status | What It Means | Action Required |
| :--- | :--- | :--- | :--- |
| **Green Shield (✓)** | **VERIFIED** | All running scripts match the official, attested release signed by the verified publisher. | Safe to browse, connect wallets, and enter credentials. |
| **Red Alert (!)** | **TAMPERING DETECTED** | One or more scripts do not match the publisher's signed release, or an unauthorized script is running. | **HIGH RISK.** Do not enter passwords, private keys, or wallet seed phrases. |
| **Gray Shield** | **UNREGISTERED** | The website publisher has not yet registered with LUCENTRA. | Normal web browsing; standard HTTPS security applies. |
| **Amber Shield** | **UNATTESTED** | Publisher is registered, but has not published an attestation for this specific version. | Exercise standard caution. |

---

## 3. Inspecting Cryptographic Evidence

Clicking the extension icon opens the **Verification Report Popup**:
- View the registered domain name and publisher's Ethereum address.
- Click the **EAS Attestation link** to view the immutable attestation on Etherscan or EAS Explorer.
- Expand the **Script Inventory** to review every executed script file, its byte size, and exact SHA-256 digest.

---

## 4. Related Documents

- [docs/04-protocol/VERIFICATION_STATES.md](../04-protocol/VERIFICATION_STATES.md)
- [docs/08-frontend/VERIFICATION_REPORT_UI.md](../08-frontend/VERIFICATION_REPORT_UI.md)

