# Accessibility & Usability (WCAG 2.1 AA) — LUCENTRA

**Document ID:** LUC-FE-007  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document defines the accessibility standards, keyboard navigation models, and screen reader guidelines ensuring the LUCENTRA dashboard and browser extension conform to WCAG 2.1 Level AA standards.

---

## 2. Core Accessibility Mandates

1. **Color Independence:** Verification states must never rely solely on color. Every status indicator must pair color with distinct icons and explicit text labels:
   - Verified: Green `#10b981` + Shield Icon 🛡️ + Text `"VERIFIED"`.
   - Mismatch: Red `#f43f5e` + Warning Triangle ⚠️ + Text `"TAMPERING DETECTED"`.
2. **Contrast Ratios:** Text and interactive elements maintain a minimum contrast ratio of 4.5:1 against their background surfaces (7:1 for headers).
3. **Keyboard Navigability:** Full focus navigation via standard `Tab` / `Shift+Tab` across all cards, modals, and tables with visible focus rings (`focus-visible:ring-2 focus-visible:ring-blue-500`).
4. **ARIA Attributes:** Verification badges implement `role="status"` with `aria-live="polite"` for non-disruptive screen reader announcements.

---

## 3. Related Documents

- [docs/08-frontend/DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- [docs/08-frontend/FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)

---

## 4. References

- [W3C Web Content Accessibility Guidelines (WCAG) 2.1](https://www.w3.org/TR/WCAG21/)

