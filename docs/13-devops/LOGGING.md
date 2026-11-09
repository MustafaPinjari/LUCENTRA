# Structured Logging Architecture — LUCENTRA

**Document ID:** LUC-OPS-006  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document defines the structured JSON logging format, log aggregation pipelines, and privacy filtering rules across LUCENTRA server components.

---

## 2. Structured JSON Log Schema

All logs are emitted as JSON lines to stdout:

```json
{
  "timestamp": "2026-11-09T18:30:00.123Z",
  "level": "INFO",
  "logger": "apps.registry.services",
  "message": "DNS TXT challenge verified successfully",
  "domain": "uniswap.org",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "durationMs": 42.5
}
```

---

## 3. PII & Secret Redaction Filters

A custom logging filter (`LucentraSecretFilter`) scrubs:
- Ethereum private keys (`0x[a-fA-F0-9]{64}`)
- JWT tokens and HTTP authorization headers
- Unhashed user IP addresses in public API logs

---

## 4. Related Documents

- [docs/13-devops/MONITORING.md](MONITORING.md)
- [docs/11-security/PRIVACY_MODEL.md](../11-security/PRIVACY_MODEL.md)

---

## 5. References

- [Python structlog Documentation](https://www.structlog.org/)

