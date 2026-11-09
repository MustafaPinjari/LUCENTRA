# Deployment Architecture — LUCENTRA

**Document ID:** LUC-ARC-008  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document outlines the deployment topology, infrastructure provisioning, network security boundaries, and hosting environments across development, staging, and production.

---

## 2. Infrastructure Deployment Topology

```mermaid
flowchart TD
    subgraph PublicInternet["Public Internet & Edge"]
        UserBrowser[Chrome Users]
        PublisherBrowser[Publisher Dashboard Users]
        CF[Cloudflare CDN & DDoS Protection / SSL]
    end

    subgraph VercelEdge["Vercel Edge Platform"]
        NextFrontend[Next.js 14 Publisher Dashboard SSR & Static]
    end

    subgraph CloudVPC["Backend Cloud VPC (AWS / GCP / Railway)"]
        ALB[Application Load Balancer / Reverse Proxy Nginx]
        
        subgraph AppCluster["App Container Cluster (Docker / ECS)"]
            DRF1[Django REST API Node 1]
            DRF2[Django REST API Node 2]
            Celery1[Celery Worker: DNS Verifier]
            Celery2[Celery Worker: Witness Ingest]
            CeleryBeat[Celery Beat Scheduler]
        end

        subgraph DataCluster["Data Persistence Layer"]
            RDS[(PostgreSQL 16 Multi-AZ)]
            RedisInst[(Redis 7 Cluster Cache & Queue)]
        end
    end

    subgraph BlockchainNetwork["Decentralized Networks"]
        EVMNetwork["Ethereum Sepolia / Arbitrum One"]
        EASRegistry["Ethereum Attestation Service Contracts"]
    end

    UserBrowser --> CF
    PublisherBrowser --> NextFrontend
    CF --> ALB
    NextFrontend --> ALB
    ALB --> DRF1
    ALB --> DRF2
    DRF1 <--> RedisInst
    DRF2 <--> RedisInst
    DRF1 <--> RDS
    DRF2 <--> RDS
    Celery1 <--> RedisInst
    Celery2 <--> RedisInst
    Celery1 <--> RDS
    Celery2 <--> RDS

    DRF1 --> EVMNetwork
    NextFrontend --> EVMNetwork
    EVMNetwork --> EASRegistry
```

---

## 3. Environment Environments & Networks

| Environment | Frontend Hosting | Backend Hosting | Database & Cache | Blockchain Network | Target Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Local Dev** | `localhost:3000` (Next.js) | `localhost:8000` (Django runserver) | Docker (PostgreSQL 16 + Redis 7) | Foundry Anvil (`localhost:8545`) | Unit & integration development |
| **Staging** | Vercel Preview | AWS ECS / Railway Staging | Managed Postgres + Redis | Ethereum Sepolia Testnet | End-to-end integration & QA |
| **Production** | Vercel Production | AWS ECS Multi-AZ / Fargate | AWS RDS Aurora Postgres + ElastiCache | Ethereum Mainnet / Arbitrum One | Production live traffic |

---

## 4. Dependencies & Security Implications

All internal database and Redis connections must be confined within private VPC subnets with SSL encryption in transit (`sslmode=require`). No database port is exposed to the public internet.

---

## 5. Related Documents

- [docs/13-devops/DEVELOPMENT_ENVIRONMENT.md](../13-devops/DEVELOPMENT_ENVIRONMENT.md)
- [docs/13-devops/BUILD_AND_DEPLOYMENT.md](../13-devops/BUILD_AND_DEPLOYMENT.md)

---

## 6. References

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

