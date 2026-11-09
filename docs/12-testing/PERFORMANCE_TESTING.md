# Performance & Load Testing Guide (k6 & Artillery) — LUCENTRA

**Document ID:** LUC-TST-007  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the load testing scripts, throughput benchmarks, and latency profiling methods for LUCENTRA APIs and extension hashing pipelines.

---

## 2. Backend Manifest Endpoint Load Test (`k6`)

Target: 500 requests/sec with p95 response time $\le 80\text{ ms}$.

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 100 },
    { duration: "1m", target: 500 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<80"], // 95% of requests must finish within 80ms
  },
};

export default function () {
  const res = http.get("http://localhost:8000/api/v1/domains/uniswap.org/manifest/active/");
  check(res, {
    "status is 200": (r) => r.status === 200,
    "has manifestHash": (r) => JSON.parse(r.body).manifestHash !== undefined,
  });
  sleep(0.1);
}
```

---

## 3. Related Documents

- [docs/00-project-overview/SUCCESS_METRICS.md](../00-project-overview/SUCCESS_METRICS.md)
- [docs/03-architecture/SCALABILITY_STRATEGY.md](../03-architecture/SCALABILITY_STRATEGY.md)

---

## 4. References

- [k6 Load Testing Documentation](https://k6.io/docs/)
