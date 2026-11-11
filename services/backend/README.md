# LUCENTRA Backend Service

**Service ID:** `lucentra-backend`  
**Framework:** Django 5.x / 6.x & Django REST Framework  
**Database:** SQLite (`services/backend/db.sqlite3`)  
**Blockchain Integration:** Local Anvil EVM (Chain ID 31337) & Ethereum Attestation Service (EAS)  
**Status:** IMPLEMENTED & TESTED (Sprint 3)

---

## 1. Overview

The LUCENTRA Backend Service coordinates the publisher verification and attestation lifecycle:

1. **DNS Ownership Verification:** Issues cryptographic DNS TXT challenges (`_lucentra-verification.<domain>`) and verifies resolution via RFC 1035 lookups using `dnspython`.
2. **Dual-Authorization Registration:** Validates publisher EIP-712 registration intents (`(domain, publisher, initialSigningKey, nonce, deadline)`) and executes on-chain registration on `PublisherRegistry.sol` via the authorized registrar account.
3. **Release Attestation Indexing:** Submits and indexes attested releases to Ethereum Attestation Service (EAS) schema `0xac04...` and verifies release integrity via `@lucentra/core`.
4. **Security & Zero Private Key Storage:** Zero publisher or operational private keys are ever stored on the backend database or memory. Cryptographic hashing and EIP-712 validation are executed through `@lucentra/core`.

---

## 2. Directory Structure

```
services/backend/
├── config/
│   ├── __init__.py
│   ├── asgi.py
│   ├── exceptions.py       # Standardized JSON error response handler
│   ├── settings.py         # SQLite, DRF, CORS, Blockchain settings
│   ├── urls.py             # Route aggregator
│   ├── views.py            # Health & Readiness endpoints
│   └── wsgi.py
├── apps/
│   ├── publishers/         # Publisher wallet model & nonce queries
│   ├── domains/            # Domains, DNS challenges, DNS verification engine
│   ├── releases/           # Signing keys & release manifests
│   ├── attestations/       # EAS indexed attestations & sync command
│   └── audit/              # Immutable audit trail
├── blockchain/
│   ├── __init__.py
│   └── client.py           # Subprocess client calling @lucentra/core CLI
├── tests/
│   ├── test_models.py
│   ├── test_dns_service.py
│   ├── test_blockchain_client.py
│   ├── test_api_health.py
│   ├── test_api_domains.py
│   ├── test_api_releases.py
│   ├── test_management_commands.py
│   └── test_e2e_live_anvil.py
├── db.sqlite3              # Native SQLite database (ignored in git)
├── manage.py
├── requirements.txt
└── .env.example
```

---

## 3. Configuration & Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DEBUG` | Enable Django debug mode | `True` |
| `ANVIL_RPC_URL` | Local Anvil JSON-RPC URL | `http://127.0.0.1:8545` |
| `CHAIN_ID` | EVM Chain ID | `31337` |
| `REGISTRAR_PRIVATE_KEY` | Local testnet registrar key (Anvil #1) | Deterministic test key |
| `DNS_CHALLENGE_PREFIX` | DNS TXT subdomain prefix | `_lucentra-verification` |
| `DNS_CHALLENGE_TTL_SECONDS` | Challenge lifespan in seconds | `900` (15 mins) |
| `DNS_CHALLENGE_MAX_ATTEMPTS`| Maximum failed verification attempts | `5` |

---

## 4. REST API Reference

All error responses adhere to the uniform JSON format:
```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable description",
    "details": null
  }
}
```

### Health & Readiness
- `GET /api/v1/health/` — Liveness check (database connectivity).
- `GET /api/v1/readiness/` — Readiness check (database + RPC + contracts + EAS schema).

### Domains & DNS
- `POST /api/v1/domains/challenges/` — Request a new DNS challenge token for a domain.
- `POST /api/v1/domains/verify-dns/` — Perform real DNS TXT lookup and mark domain verified.
- `POST /api/v1/domains/register/` — Submit dual-authorized on-chain domain registration.
- `GET /api/v1/domains/` — List registered domains.
- `GET /api/v1/domains/{domain}/` — Get domain details.
- `GET /api/v1/domains/{domain}/keys/` — List active release-signing keys.
- `GET /api/v1/domains/{domain}/releases/` — List releases for domain.
- `GET /api/v1/domains/{domain}/verification-status/` — Query cryptographic verification status.

### Releases & Attestations
- `POST /api/v1/releases/` — Ingest, cryptographically verify, and attest a signed release manifest on EAS.
- `POST /api/v1/releases/verify/` — Perform complete release verification against observed resources.
- `GET /api/v1/releases/{id}/` — Retrieve release detail and manifest.
- `GET /api/v1/attestations/{uid}/` — Retrieve indexed attestation record (`?live=true` cross-checks on-chain EAS).

### Management Commands
- `python manage.py sync_attestations` — Refresh and sync EAS attestation revocation status from blockchain.

---

## 5. Development & Testing

### Running Tests
```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-backend.ps1
# Or directly:
python services/backend/manage.py test tests
```

### Running Server
```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-backend.ps1
```
