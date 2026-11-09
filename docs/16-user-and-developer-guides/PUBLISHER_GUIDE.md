# Publisher Onboarding & Signing Guide — LUCENTRA

**Document ID:** LUC-USR-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This user guide walks web application publishers through registering a domain, creating a signed release manifest, and attesting it on Ethereum.

---

## 2. Step-by-Step Publisher Onboarding

### Phase 1: Connect Wallet & Request DNS Challenge
1. Open the LUCENTRA Dashboard (`https://app.lucentra.io`).
2. Click **Connect Wallet** and sign in using your hardware wallet or MetaMask.
3. Click **Add Domain** and enter your production domain (e.g. `app.example.com`).
4. The dashboard displays your unique challenge string:
   - **Type:** `TXT`
   - **Host:** `_lucentra-verification.app.example.com`
   - **Value:** `lucentra-challenge=<token>`

### Phase 2: Configure DNS & Complete On-Chain Registration
1. Add the TXT record in your DNS provider (Cloudflare, AWS Route53, Namecheap).
2. Return to the dashboard and click **Verify DNS**.
3. Once verified, click **Register On-Chain**. Your wallet prompts a transaction calling `PublisherRegistry.registerDomain`.

### Phase 3: Create & Attest a Release
1. In the dashboard, navigate to **Releases $\rightarrow$ New Release**.
2. Upload your production build folder (`dist/` or `out/`).
3. Click **Sign & Attest Release**. Confirm the EIP-712 structured data prompt in your wallet.
4. Your release is now cryptographically active across the internet!

---

## 3. Related Documents

- [docs/08-frontend/PUBLISHER_WORKFLOWS.md](../08-frontend/PUBLISHER_WORKFLOWS.md)
- [docs/05-cryptography/EIP712_SIGNING.md](../05-cryptography/EIP712_SIGNING.md)
