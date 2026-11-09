# API Error Handling & Status Codes — LUCENTRA

**Document ID:** LUC-BE-009  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document defines standard error responses, RFC 7807 Problem Details formatting, and HTTP status codes returned by the LUCENTRA backend API.

---

## 2. Standard Error Envelope (RFC 7807)

All non-2xx responses conform strictly to:

```json
{
  "type": "https://lucentra.io/errors/invalid-manifest",
  "title": "Invalid Release Manifest",
  "status": 400,
  "detail": "Resource path '/app.js' declares an invalid SHA-256 hash format.",
  "instance": "/api/v1/releases/",
  "code": "ERR_INVALID_MANIFEST_HASH",
  "timestamp": "2026-11-09T18:00:00Z"
}
```

---

## 3. Error Code Catalog

| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400 Bad Request` | `ERR_SCHEMA_VALIDATION_FAILED` | Payload violates JSON Schema. |
| `400 Bad Request` | `ERR_CANONICALIZATION_FAILED` | Manifest cannot be parsed by RFC 8785 canonicalizer. |
| `401 Unauthorized` | `ERR_INVALID_SIWE_SIGNATURE` | SIWE signature recovery failed. |
| `403 Forbidden` | `ERR_NOT_DOMAIN_OWNER` | Wallet is not authorized for this domain. |
| `404 Not Found` | `ERR_DOMAIN_NOT_FOUND` | Domain not found in registry. |
| `404 Not Found` | `ERR_NO_ACTIVE_RELEASE` | Domain exists but has no active release manifest. |
| `429 Too Many Requests` | `ERR_RATE_LIMIT_EXCEEDED` | Request rate limit exceeded (100 req/min per IP). |
| `502 Bad Gateway` | `ERR_RPC_COMMUNICATION_FAILED` | Upstream Ethereum RPC node timeout. |

---

## 4. Related Documents

- [docs/07-backend/API_SPECIFICATION.md](API_SPECIFICATION.md)

---

## 5. References

- [IETF RFC 7807: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc7807.html)
