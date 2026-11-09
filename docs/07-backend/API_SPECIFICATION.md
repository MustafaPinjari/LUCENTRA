# REST API Specification (OpenAPI 3.1) — LUCENTRA

**Document ID:** LUC-BE-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the REST API endpoints, request/response JSON schemas, authentication mechanisms, and status codes exposed by the LUCENTRA Django backend.

---

## 2. API Endpoints Catalog

### 2.1 Public Verification Endpoints (Used by Chrome Extension)

#### `GET /api/v1/domains/{domain}/manifest/active/`
- **Description:** Returns the active, attested release manifest for a given normalized domain name.
- **Parameters:** `domain` (path string, e.g. `app.uniswap.org`).
- **Response 200 (OK):**
```json
{
  "domain": "app.uniswap.org",
  "version": "4.12.0",
  "manifestHash": "0x7a30c5e3155799a74421b47596ff1b3924fdbb8d655f419b2a64c4897f1f3e72",
  "easAttestationUid": "0x456def789abc0123456789abcdef0123456789abcdef0123456789abcdef0123",
  "signingAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "createdAt": 1731196800,
  "expiresAt": 1762732800,
  "manifest": {
    "schemaVersion": "LUCENTRA-Manifest-v0.1",
    "domain": "app.uniswap.org",
    "version": "4.12.0",
    "createdAt": 1731196800,
    "expiresAt": 1762732800,
    "resources": [
      {
        "path": "/_next/static/chunks/main-app.js",
        "size": 145028,
        "sha256": "sha256:4d4be953a817b1897d26bb4387877ce5cb8927878347fe3a693240ee09736829",
        "type": "script"
      }
    ]
  }
}
```
- **Response 404 (Not Found):** Domain unregistered or no active release manifest.

---

### 2.2 Publisher Domain Registration Endpoints

#### `POST /api/v1/domains/challenge/`
- **Description:** Initiates domain ownership verification challenge.
- **Request Body:**
```json
{
  "domain": "example.com"
}
```
- **Response 201 (Created):**
```json
{
  "domain": "example.com",
  "challengeHost": "_lucentra-verification.example.com",
  "challengeValue": "lucentra-challenge=8f39a7b1c4e201f9d6a3b2c1e0f8d7c6b5a4",
  "expiresAt": 1731283200
}
```

#### `POST /api/v1/domains/verify-dns/`
- **Description:** Triggers authoritative DNS lookup to confirm the TXT record and returns a cryptographic authorization ticket for calling `PublisherRegistry.registerDomain`.
- **Request Body:**
```json
{
  "domain": "example.com",
  "ownerAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
}
```
- **Response 200 (OK):**
```json
{
  "status": "VERIFIED",
  "domain": "example.com",
  "ownerAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "deadline": 1731200400,
  "verifierSignature": "0x123abc..."
}
```

---

### 2.3 Release Ingestion Endpoints

#### `POST /api/v1/releases/`
- **Description:** Ingests a signed release manifest and its confirmed EAS Attestation UID.
- **Request Body:**
```json
{
  "domain": "example.com",
  "easAttestationUid": "0x456def...",
  "manifestJson": "{...}"
}
```
- **Response 201 (Created):**
```json
{
  "releaseId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ACTIVE",
  "manifestHash": "0x7a30c5..."
}
```

---

## 3. Related Documents

- [docs/07-backend/BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md)
- [docs/07-backend/AUTHENTICATION.md](AUTHENTICATION.md)

---

## 4. References

- [OpenAPI Specification 3.1](https://spec.openapis.org/oas/latest.html)
