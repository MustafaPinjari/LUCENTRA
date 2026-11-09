# Disaster Recovery & Backup Policy — LUCENTRA

**Document ID:** LUC-OPS-007  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document outlines data backup frequencies, Disaster Recovery (DR) protocols, Recovery Point Objectives (RPO), and Recovery Time Objectives (RTO) for LUCENTRA infrastructure.

---

## 2. RPO and RTO Targets

- **Recovery Point Objective (RPO):** $\le 1\text{ hour}$ for off-chain manifest metadata. (On-chain state has an RPO of 0 seconds due to Ethereum blockchain immutability).
- **Recovery Time Objective (RTO):** $\le 2\text{ hours}$ for full backend restoration from encrypted backups.

---

## 3. Backup Schedule & Redundancy

1. **PostgreSQL Snapshots:** Automated daily snapshots retained for 30 days; point-in-time recovery (PITR) enabled via Write-Ahead Logging (WAL).
2. **Blockchain State Re-indexing:** In the event of total database loss, all domain registrations, key authorizations, and EAS release attestations can be completely reconstructed by replaying event logs directly from Ethereum / Arbitrum RPCs.

---

## 4. Related Documents

- [docs/13-devops/BUILD_AND_DEPLOYMENT.md](BUILD_AND_DEPLOYMENT.md)
- [docs/07-backend/DATABASE_SCHEMA.md](../07-backend/DATABASE_SCHEMA.md)

---

## 5. References

- [AWS RDS Backup and Restore](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.BackupRestore.html)
