# Environment Variables & Secret Configuration — LUCENTRA

**Document ID:** LUC-OPS-002  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document catalogs all environment variables, secret stores, and configuration settings required across the LUCENTRA subsystems.

---

## 2. Environment Variables Catalog

### 2.1 Backend Services (`services/backend/.env`)
```env
# Django Core
DEBUG=True
SECRET_KEY="django-insecure-local-dev-key"
ALLOWED_HOSTS="localhost,127.0.0.1,api.lucentra.io"

# Database & Cache
DATABASE_URL="postgres://postgres:postgres@localhost:5432/lucentra"
REDIS_URL="redis://localhost:6379/0"

# Blockchain & Verifier
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"
DNS_VERIFIER_PRIVATE_KEY="0x..." # Backend key for signing DNS proof tickets
PUBLISHER_REGISTRY_ADDRESS="0x..."
EAS_CONTRACT_ADDRESS="0xC2679fBD37d54388Ce493F1DB75320D236e1815e"
```

### 2.2 Next.js Dashboard (`apps/dashboard/.env.local`)
```env
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXT_PUBLIC_SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"
NEXT_PUBLIC_PUBLISHER_REGISTRY_ADDRESS="0x..."
NEXT_PUBLIC_EAS_CONTRACT_ADDRESS="0xC2679fBD37d54388Ce493F1DB75320D236e1815e"
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="YOUR_WALLETCONNECT_ID"
```

---

## 3. Secret Management Mandates
- No `.env` files may ever be committed to Git (enforced via `.gitignore`).
- Production secrets are injected dynamically via AWS Secrets Manager or HashiCorp Vault.

---

## 4. Related Documents

- [docs/13-devops/DEVELOPMENT_ENVIRONMENT.md](DEVELOPMENT_ENVIRONMENT.md)
- [SECURITY.md](../../SECURITY.md)

---

## 5. References

- [The Twelve-Factor App: Config](https://12factor.net/config)
