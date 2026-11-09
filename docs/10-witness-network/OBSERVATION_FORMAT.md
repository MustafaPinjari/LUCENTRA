# Observation Format Specification (v0.1) — LUCENTRA

**Document ID:** LUC-WIT-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides the formal JSON schema and validation rules for signed audit observations produced by LUCENTRA witness nodes.

---

## 2. JSON Observation Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://lucentra.io/schemas/witness-observation-v0.1.json",
  "title": "LUCENTRA Witness Observation Schema v0.1",
  "type": "object",
  "required": [
    "schemaVersion",
    "witnessAddress",
    "domain",
    "easAttestationUid",
    "manifestHash",
    "observedAt",
    "crawlerGeo",
    "status",
    "observedResources",
    "signature"
  ],
  "properties": {
    "schemaVersion": { "type": "string", "const": "LUCENTRA-Witness-v0.1" },
    "witnessAddress": { "type": "string", "pattern": "^0x[a-fA-F0-9]{40}$" },
    "domain": { "type": "string" },
    "easAttestationUid": { "type": "string", "pattern": "^0x[a-fA-F0-9]{64}$" },
    "manifestHash": { "type": "string", "pattern": "^0x[a-fA-F0-9]{64}$" },
    "observedAt": { "type": "integer" },
    "crawlerGeo": { "type": "string" },
    "status": { "type": "string", "enum": ["CONSISTENT", "MISMATCH", "UNREACHABLE"] },
    "observedResources": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "sha256", "matched"],
        "properties": {
          "path": { "type": "string" },
          "sha256": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
          "matched": { "type": "boolean" }
        }
      }
    },
    "signature": { "type": "string", "pattern": "^0x[a-fA-F0-9]{130}$" }
  }
}
```

---

## 3. Related Documents

- [docs/10-witness-network/WITNESS_ARCHITECTURE.md](WITNESS_ARCHITECTURE.md)
- [docs/04-protocol/WITNESS_PROTOCOL.md](../04-protocol/WITNESS_PROTOCOL.md)

---

## 4. References

- [JSON Schema Specification](https://json-schema.org/)

