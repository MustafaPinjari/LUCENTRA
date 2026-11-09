# Background Jobs & Celery Worker Architecture — LUCENTRA

**Document ID:** LUC-BE-010  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the Celery task queue architecture, scheduled jobs (Celery Beat), retry policies, and worker concurrency configurations for LUCENTRA.

---

## 2. Worker Queue Layout

```mermaid
flowchart TD
    RedisBroker[(Redis Broker)] --> Q_DNS[Queue: dns_verification]
    RedisBroker --> Q_EAS[Queue: blockchain_sync]
    RedisBroker --> Q_WIT[Queue: witness_batch]

    Q_DNS --> WorkerDNS[Celery Worker: DNS Verifier (Concurrency: 4)]
    Q_EAS --> WorkerEAS[Celery Worker: EVM Event Listener (Concurrency: 2)]
    Q_WIT --> WorkerWIT[Celery Worker: Witness Ingestion (Concurrency: 8)]
```

---

## 3. Scheduled Tasks Catalog (Celery Beat)

1. **`tasks.poll_pending_dns_challenges`:** Runs every 60 seconds. Queries authoritative nameservers for pending domain challenges.
2. **`tasks.sync_eas_revocations`:** Runs every 30 seconds. Checks EAS contracts for newly registered attestation revocations.
3. **`tasks.purge_expired_challenges`:** Runs every hour. Cleans up DNS challenges older than 24 hours.

---

## 4. Idempotency & Retry Policies

- All tasks implement explicit exponential backoff:
```python
@shared_task(bind=True, max_retries=5, default_retry_delay=10)
def check_dns_txt_record(self, challenge_id: str):
    ...
```
- Database mutations wrap in transactions (`transaction.atomic`) with row-level locking (`select_for_update()`) to prevent race conditions during concurrent worker execution.

---

## 5. Related Documents

- [docs/07-backend/DOMAIN_VERIFICATION.md](DOMAIN_VERIFICATION.md)
- [docs/07-backend/WITNESS_MANAGEMENT.md](WITNESS_MANAGEMENT.md)

---

## 6. References

- [Celery Task Execution Guide](https://docs.celeryq.dev/en/stable/userguide/tasks.html)

