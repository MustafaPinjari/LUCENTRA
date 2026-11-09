# Manifest Schema Specification (v0.1) — LUCENTRA

**Document ID:** LUC-PRO-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document provides the formal JSON Schema (Draft 2020-12) for the `LUCENTRA-Manifest-v0.1` release manifest format.

---

## 2. JSON Schema Definition

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://lucentra.io/schemas/manifest-v0.1.json",
  "title": "LUCENTRA Release Manifest Schema v0.1",
  "type": "object",
  "required": [
    "schemaVersion",
    "domain",
    "version",
    "createdAt",
    "expiresAt",
    "resources"
  ],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": {
      "type": "string",
      "const": "LUCENTRA-Manifest-v0.1"
    },
    "domain": {
      "type": "string",
      "pattern": "^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$"
    },
    "version": {
      "type": "string",
      "minLength": 1,
      "maxLength": 64
    },
    "createdAt": {
      "type": "integer",
      "minimum": 0,
      "description": "Unix timestamp in seconds when the manifest was generated"
    },
    "expiresAt": {
      "type": "integer",
      "minimum": 0,
      "description": "Unix timestamp in seconds after which this manifest is expired"
    },
    "resources": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["path", "size", "sha256", "type"],
        "additionalProperties": false,
        "properties": {
          "path": {
            "type": "string",
            "pattern": "^/.*",
            "description": "Root-relative path to the script asset"
          },
          "size": {
            "type": "integer",
            "minimum": 0,
            "description": "Exact file length in bytes"
          },
          "sha256": {
            "type": "string",
            "pattern": "^sha256:[a-f0-9]{64}$",
            "description": "Lowercase hex SHA-256 digest prefixed with 'sha256:'"
          },
          "type": {
            "type": "string",
            "enum": ["script", "module", "worker"]
          }
        }
      }
    }
  }
}
```

---

## 3. Validation Constraints

1. **Path Normalization:** Resource `path` strings must begin with a leading forward slash `/` and must not contain directory traversal tokens (`../` or `./`).
2. **Hash Format:** The `sha256` field must be strictly lowercase hex (64 characters) preceded by the standard prefix `sha256:`.
3. **Temporal Validity:** `expiresAt` must be strictly greater than `createdAt`.

---

## 4. Related Documents

- [docs/04-protocol/CANONICALIZATION.md](CANONICALIZATION.md)
- [docs/04-protocol/PROTOCOL_SPECIFICATION_V0.1.md](PROTOCOL_SPECIFICATION_V0.1.md)

---

## 5. References

- [JSON Schema Specification Draft 2020-12](https://json-schema.org/draft/2020-12/release-notes)

