# API Developer Guide & SDK Integration — LUCENTRA

**Document ID:** LUC-USR-005  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This guide assists third-party developers, indexers, and automated CI/CD bots in consuming LUCENTRA REST APIs and interacting with smart contracts.

---

## 2. Consuming the Public Manifest API (cURL / TypeScript)

### cURL Example
```bash
curl -X GET "https://api.lucentra.io/api/v1/domains/uniswap.org/manifest/active/" \
  -H "Accept: application/json"
```

### TypeScript Client Example (`@lucentra/sdk`)
```typescript
import { LucentraClient } from "@lucentra/sdk";

const client = new LucentraClient({
  network: "sepolia",
  rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY"
});

const release = await client.getActiveRelease("uniswap.org");
console.log("Active Version:", release.version);
console.log("Attestation UID:", release.easAttestationUid);
console.log("Total Verified Scripts:", release.manifest.resources.length);
```

---

## 3. Related Documents

- [docs/07-backend/API_SPECIFICATION.md](../07-backend/API_SPECIFICATION.md)
- [docs/06-blockchain/CONTRACT_INTERFACES.md](../06-blockchain/CONTRACT_INTERFACES.md)

