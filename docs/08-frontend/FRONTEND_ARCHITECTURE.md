# Frontend Architecture (Next.js 14) — LUCENTRA

**Document ID:** LUC-FE-001  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the Next.js 14 frontend architecture for the LUCENTRA Publisher Dashboard, covering App Router directory layout, state management, Web3 wallet integration, and Tailwind CSS design principles.

---

## 2. Directory Layout (App Router)

```
apps/dashboard/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                      // Overview
│   │   ├── domains/
│   │   │   ├── page.tsx                  // Domain list
│   │   │   ├── new/page.tsx              // Onboarding wizard
│   │   │   └── [domain]/page.tsx         // Domain details & key management
│   │   └── releases/
│   │       ├── page.tsx                  // Releases history
│   │       └── new/page.tsx              // Release builder & signer
│   ├── api/                              // Next.js Route Handlers (BFF)
│   ├── layout.tsx                        // Root layout with Providers
│   └── globals.css
├── components/
│   ├── ui/                               // Primitive components (Button, Modal, etc.)
│   ├── wallet/                           // Wagmi connectors, account modal
│   ├── domains/                          // Domain registration & DNS cards
│   └── releases/                         // Manifest dropzone & signing modal
├── hooks/                                // Custom React hooks
├── lib/
│   ├── viemClient.ts                     // Viem & Wagmi configuration
│   ├── canonical.ts                      // RFC 8785 in-browser canonicalizer
│   └── api.ts                            // Axios / Fetch wrapper for Backend API
```

---

## 3. Technology Stack Integration

- **Framework:** Next.js 14 (React 18, App Router, TypeScript).
- **Styling:** Tailwind CSS with CSS Variables for theming.
- **Web3 Connector:** Wagmi v2 + Viem + TanStack React Query.
- **Form Management:** React Hook Form + Zod schema validation.

---

## 4. Related Documents

- [docs/08-frontend/DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- [docs/08-frontend/WALLET_INTEGRATION.md](WALLET_INTEGRATION.md)

---

## 5. References

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Wagmi Documentation](https://wagmi.sh/)
