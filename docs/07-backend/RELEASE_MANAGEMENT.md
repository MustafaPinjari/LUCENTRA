# Release Management & Manifest Ingestion — LUCENTRA

**Document ID:** LUC-BE-006  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the backend ingestion, validation, and storage pipeline for publisher release manifests.

---

## 2. Ingestion Validation Pipeline

```mermaid
flowchart TD
    Payload[POST /api/v1/releases/ Payload] --> ValidateJSON[Validate JSON against LUCENTRA-Manifest-v0.1 Schema]
    ValidateJSON --> Canonicalize[Run RFC 8785 Canonicalization]
    Canonicalize --> ComputeHash[Compute SHA-256 Manifest Hash]
    
    ComputeHash --> QueryEAS[Query EAS Smart Contract for Attestation UID]
    QueryEAS --> ValidateAttestor{Is Attestor an authorized key in PublisherRegistry?}
    
    ValidateAttestor -- No --> RevertReject[Reject Ingestion: HTTP 403 Forbidden]
    ValidateAttestor -- Yes --> CompareDigest{Does EAS data manifestHash == computed manifestHash?}
    
    CompareDigest -- No --> RevertTamper[Reject Ingestion: HTTP 400 Bad Request]
    CompareDigest -- Yes --> SaveDB[Save Release in PostgreSQL & Update Active Pointer]
    SaveDB --> PurgeCache[Purge Redis Domain Cache]
```

---

## 3. Storage Optimization

The raw canonical manifest JSON is stored in PostgreSQL as `canonical_manifest_json` (Text / JSONB) and indexed in Redis under key `lucentra:manifest:{normalized_domain}:active` with an eviction TTL of 3600 seconds.

---

## 4. Related Documents

- [docs/04-protocol/MANIFEST_SCHEMA.md](../04-protocol/MANIFEST_SCHEMA.md)
- [docs/07-backend/DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)

---

## 5. References

- [Django REST Framework Serializers](https://www.django-rest-framework.org/api-guide/serializers/)

