# Contributing to LUCENTRA

**Document ID:** LUC-GOV-001  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Code of Conduct and Operating Standards

LUCENTRA is an engineering-first, high-assurance cryptographic verification system. All human developers and AI engineering agents must adhere to the highest standards of code clarity, cryptographic rigor, and architectural discipline.

Prior to writing code or submitting pull requests, you must read:
- [AGENTS.md](AGENTS.md)
- [SECURITY.md](SECURITY.md)
- [docs/15-ai-agent-governance/MASTER_AGENT_INSTRUCTIONS.md](docs/15-ai-agent-governance/MASTER_AGENT_INSTRUCTIONS.md)

---

## 2. Branching and Workflow Strategy

LUCENTRA uses a modified Trunk-Based Development workflow with strict branch protections:

- `main`: Production-ready, fully tested, and verified state. Direct commits are strictly prohibited.
- `develop`: Integration branch for tested features.
- `feature/<issue-id>-<short-description>`: Feature work branches.
- `fix/<issue-id>-<short-description>`: Bugfix branches.
- `docs/<short-description>`: Documentation additions and synchronizations.

### Commit Message Conventions

We strictly follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat(contracts): add EIP-712 domain separator validation`
- `fix(extension): resolve race condition in DOM script mutation observer`
- `docs(protocol): update RFC 8785 canonicalization test vectors`
- `test(backend): add test for DNS TXT verification retry logic`
- `refactor(frontend): decouple wagmi connection provider`

---

## 3. Pull Request Requirements

Every pull request must satisfy the following checklist before merge consideration:

1. **Traceability:** Links directly to an approved requirement in `docs/01-product-management/` or an approved Architecture Decision Record in `docs/03-architecture/decisions/`.
2. **Status Alignment:** Does not claim a status (e.g. `VERIFIED`) without meeting defined transition criteria.
3. **Automated Testing:** 
   - Smart contracts: 100% Foundry test pass, fuzzing coverage where input variables are unbounded.
   - Backend: Pytest coverage with no regressions.
   - Frontend & Extension: Jest/Vitest unit tests passing.
4. **Documentation Synchronization:** If any interface, schema, endpoint, or behavior changes, the corresponding document in `docs/` must be updated within the same PR.
5. **Security Review:** PRs touching cryptographic functions, key management, permissions, or cross-origin communication must include a completed Security Review template (`docs/templates/SECURITY_REVIEW_TEMPLATE.md`).

---

## 4. Environment Setup

Refer to [docs/13-devops/DEVELOPMENT_ENVIRONMENT.md](docs/13-devops/DEVELOPMENT_ENVIRONMENT.md) for full setup instructions across:
- Node.js (v20+) & pnpm
- Python (3.11+) & Poetry / venv
- Foundry (forge, cast, anvil)
- Docker & Docker Compose (PostgreSQL & Redis)

