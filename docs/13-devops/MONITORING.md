# Monitoring, Metrics & Observability — LUCENTRA

**Document ID:** LUC-OPS-005  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the telemetry, metrics collection (Prometheus / Grafana), health check probes, and alerting rules for LUCENTRA infrastructure.

---

## 2. Key Metrics & Observability Indicators

1. **API Latency & Error Rate:** Prometheus counter `http_requests_total` and histogram `http_request_duration_seconds` tracking p50, p90, and p99 response times.
2. **Celery Queue Depth:** Gauge tracking pending DNS resolution tasks in Redis.
3. **EVM Event Sync Lag:** Difference between latest Ethereum block height and last processed event block.
4. **Witness Anomaly Frequency:** Count of divergent witness observations flagged per hour.

---

## 3. Health Check Endpoints

- `GET /health/live/`: Returns 200 OK if Gunicorn process is responsive.
- `GET /health/ready/`: Returns 200 OK only if PostgreSQL, Redis, and Ethereum RPC connections are established.

---

## 4. Related Documents

- [docs/13-devops/LOGGING.md](LOGGING.md)
- [docs/00-project-overview/SUCCESS_METRICS.md](../00-project-overview/SUCCESS_METRICS.md)

---

## 5. References

- [Prometheus Documentation](https://prometheus.io/docs/introduction/overview/)
- [Grafana Documentation](https://grafana.com/docs/)
