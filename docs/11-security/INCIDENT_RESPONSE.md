# Incident Response Plan — LUCENTRA

**Document ID:** LUC-SEC-009  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document establishes the emergency procedures, escalation paths, and remediation protocols for handling security incidents, including private key compromises, CDN breaches, and contract exploits.

---

## 2. Incident Classification & Response Workflows

```mermaid
flowchart TD
    Incident[Security Incident Detected] --> Triage{Incident Classification}
    
    Triage -- Severity 1: Publisher Signing Key Compromise --> Action1[1. Publisher Owner calls revokeKey on PublisherRegistry<br/>2. Invalidate EAS Attestations<br/>3. Purge API Redis Cache]
    Triage -- Severity 1: Active Website Magecart Skimmer --> Action2[1. Alert Publisher Security Lead<br/>2. Issue On-Chain Revocation<br/>3. Extension flags MISMATCH]
    Triage -- Severity 2: Backend Server Compromised --> Action3[1. Rotate Backend DB & RPC Keys<br/>2. Rebuild Containers from Git Source<br/>3. Verify Contract Integrations]
    
    Action1 --> PostMortem[Conduct Formal Post-Mortem & Publish Disclosure]
    Action2 --> PostMortem
    Action3 --> PostMortem
```

---

## 3. Communication & Key Contacts

- **Security Team Dispatch:** `security@lucentra.io`
- **SLA:** Critical incidents acknowledged within 15 minutes; on-chain key revocation executed within 1 hour.

---

## 4. Related Documents

- [docs/05-cryptography/KEY_ROTATION_AND_REVOCATION.md](../05-cryptography/KEY_ROTATION_AND_REVOCATION.md)
- [SECURITY.md](../../SECURITY.md)

---

## 5. References

- [NIST SP 800-61: Computer Security Incident Handling Guide](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final)
