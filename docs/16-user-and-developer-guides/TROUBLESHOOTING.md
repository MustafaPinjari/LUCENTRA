# Troubleshooting & Diagnostic FAQ — LUCENTRA

**Document ID:** LUC-USR-006  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides diagnostic troubleshooting procedures, common failure modes, and resolutions for publishers, developers, and extension users.

---

## 2. Common Issues & Resolutions

### Issue 1: "DNS Verification Failed: TXT record not found"
- **Cause:** DNS propagation delay or incorrect subdomain label.
- **Resolution:** Verify that the TXT record host is set to `_lucentra-verification.<your-domain>` (e.g. `_lucentra-verification.app.example.com`). Check propagation via terminal: `dig TXT _lucentra-verification.app.example.com`. Wait up to 5 minutes for TTL expiration.

### Issue 2: "Extension displays Red Alert on my own site"
- **Cause:** You deployed a new build to your hosting origin before publishing an attested release manifest, or dynamic code-splitting generated new chunks.
- **Resolution:** In the publisher dashboard, generate a new release manifest from your live build and attest it via your wallet. Refresh the site once the attestation confirms on-chain.

### Issue 3: "EIP-712 Signature Reverts on Contract"
- **Cause:** Wallet connected to wrong network (e.g. Mainnet instead of Sepolia) or verifying contract address mismatch.
- **Resolution:** Confirm your wallet is on the correct Chain ID and verify that `verifyingContract` in the domain separator matches the deployed `PublisherRegistry` address.

---

## 3. Related Documents

- [docs/16-user-and-developer-guides/PUBLISHER_GUIDE.md](PUBLISHER_GUIDE.md)
- [docs/07-backend/ERROR_HANDLING.md](../07-backend/ERROR_HANDLING.md)

