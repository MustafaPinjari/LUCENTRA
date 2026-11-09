# Security Review Template

**Review ID:** SEC-REV-XXX  
**Target Feature / Component:** [Name of component or PR]  
**Lead Reviewer:** Security Architect (Agent 7)  
**Date:** YYYY-MM-DD  
**Overall Verdict:** [APPROVED | APPROVED_WITH_CONDITIONS | REJECTED]  

---

## 1. Scope of Review
[List repositories, file paths, smart contracts, or endpoints evaluated.]

---

## 2. Threat Analysis (STRIDE Checklist)
- [ ] **Spoofing:** Identity validation, signature checking, domain verification.
- [ ] **Tampering:** Data in transit, canonicalization, manifest hashing.
- [ ] **Repudiation:** Non-repudiation of release signatures via EIP-712 and on-chain logs.
- [ ] **Information Disclosure:** Protection of keys, tokens, and PII.
- [ ] **Denial of Service:** Rate limiting, gas limits, payload size caps.
- [ ] **Elevation of Privilege:** RBAC, smart contract owner controls, extension permissions.

---

## 3. Findings Summary

| ID | Severity | Description | Status | Remediation Required |
| :--- | :--- | :--- | :--- | :--- |
| SEC-01 | HIGH | ... | OPEN | ... |

---

## 4. Remediation Sign-Off
- [ ] All high/critical findings resolved.
- [ ] Regression tests added.
- [ ] Final sign-off by Security Architect.

