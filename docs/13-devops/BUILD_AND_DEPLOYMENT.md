# Build and Deployment Guide — LUCENTRA

**Document ID:** LUC-OPS-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the build processes, containerization specifications, and deployment workflows for all LUCENTRA subsystems.

---

## 2. Docker Containerization Strategy

### 2.1 Backend Container (`services/backend/Dockerfile`)
- Multi-stage build using `python:3.11-slim`.
- Installs dependencies in build stage, copies wheels to runtime stage.
- Runs non-root user `django` for container security.
- Entrypoint executes database migrations and starts Gunicorn WSGI.

### 2.2 Next.js Dashboard Deployment
- Deployed via Vercel Edge Network or standalone Docker container.
- Static assets served via CDN; API route handlers run in edge lambda runtime.

### 2.3 Chrome Extension Artifact
- Built using Vite / TypeScript: `pnpm --filter @lucentra/extension build`.
- Generates zip archive `lucentra-extension-v0.1.0.zip` ready for Chrome Web Store upload.

---

## 3. Related Documents

- [docs/13-devops/CI_CD.md](CI_CD.md)
- [docs/03-architecture/DEPLOYMENT_ARCHITECTURE.md](../03-architecture/DEPLOYMENT_ARCHITECTURE.md)

---

## 4. References

- [Docker Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)

