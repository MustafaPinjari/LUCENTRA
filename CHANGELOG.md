# Changelog — LUCENTRA

All notable changes to the LUCENTRA architecture, documentation, and implementation are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Comprehensive engineering documentation system spanning 18 core documentation directories and templates.
- Architecture Decision Records (ADRs 001 through 010) covering hybrid Web2/Web3 topology, EIP-712, RFC 8785, EAS attestations, and Chrome MV3.
- Protocol specification v0.1 for canonical manifest structure, domain normalization, and multi-state verification engine.
- Cryptographic specification for SHA-256 asset pipelines, secp256k1 signature validation, and replay protection.
- Smart contract architecture for `PublisherRegistry.sol` and Ethereum Attestation Service (EAS) schema integrations.
- Backend architecture specifying Django REST Framework models, serializers, Celery workers, and DNS verification pipeline.
- Frontend architecture detailing Next.js 14 dashboard, Wagmi/Viem wallet integration, and verification reporting components.
- Chrome Extension architecture detailing Manifest V3 service worker, content scripts, DOM script interception, and Web Worker SHA-256 hashing.
- Independent witness network architecture and observation format.
- Multi-agent AI governance framework (`AGENTS.md`, role definitions, context loading policies, and handoff protocols).
- Global security threat model (STRIDE), attack surface analysis, and security audit checklists.

---

## [0.1.0-alpha.doc] - 2026-11-09

### Added
- Initial project creation and repository inspection report.
- Established documentation hierarchy and lifecycle status definitions (`PROPOSED`, `APPROVED`, `IN_PROGRESS`, `IMPLEMENTED`, `TESTED`, `VERIFIED`, `DEPRECATED`).
