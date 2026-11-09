# Verification Engine & Query Optimizer — LUCENTRA

**Document ID:** LUC-BE-007  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the backend query execution path, Redis caching strategy, and performance optimizations governing public manifest queries from browser extensions.

---

## 2. High-Throughput Verification Path

To fulfill the requirement of $\le 80\text{ ms}$ (p95) API response time under high concurrency:

```mermaid
flowchart LR
    Req[GET /api/v1/domains/{domain}/manifest/active/] --> Norm[Normalize Domain]
    Norm --> RedisCheck{In Redis Cache?}
    RedisCheck -- Hit (<2ms) --> RetCached[Return Cached JSON Payload]
    RedisCheck -- Miss --> DBQuery[PostgreSQL Index Scan on normalized_name]
    DBQuery --> PopulateCache[Write to Redis with 1h TTL]
    PopulateCache --> RetDB[Return JSON Payload]
```

---

## 3. Cache Invalidation Triggers

The cache key `lucentra:manifest:{domain}:active` is immediately purged upon:
1. Ingestion of a newer release version via `POST /api/v1/releases/`.
2. Receipt of an on-chain `KeyRevoked` or `DomainRevoked` event caught by the blockchain listener worker.

---

## 4. Related Documents

- [docs/07-backend/BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md)
- [docs/03-architecture/SCALABILITY_STRATEGY.md](../03-architecture/SCALABILITY_STRATEGY.md)

---

## 5. References

- [Redis In-Memory Data Store](https://redis.io/)
