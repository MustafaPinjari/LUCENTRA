# Resource Inspection & MutationObserver Design — LUCENTRA

**Document ID:** LUC-EXT-006  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the DOM inspection mechanism implemented by the Chrome Extension to capture all JavaScript execution entry points, including static `<script>` tags, dynamic script injections, and worker scripts.

---

## 2. Dynamic DOM Injection Interception

Modern web applications frequently inject scripts dynamically:
```javascript
const s = document.createElement("script");
s.src = "https://cdn.example.com/chunk-123.js";
document.head.appendChild(s);
```

The extension intercepts dynamic insertions via:
1. `MutationObserver` on `document.documentElement` configured with `{ childList: true, subtree: true }`.
2. Deduplication using an in-memory `Set<string>` of observed script URLs per document lifetime.
3. Handling both absolute URLs (`https://...`) and root-relative URLs (`/_next/...`).

---

## 3. Inline Script Handling (MVP Scope Boundary)

For MVP v0.1:
- Static and dynamic external `<script src="...">` tags are strictly verified against manifest resources.
- Inline `<script>` tags without `src` attributes are audited: if an unregistered inline script is detected on a registered domain, a caution flag is attached to the verification report.

---

## 4. Related Documents

- [docs/09-browser-extension/CONTENT_SCRIPTS.md](CONTENT_SCRIPTS.md)
- [docs/09-browser-extension/RESOURCE_HASHING.md](RESOURCE_HASHING.md)

---

## 5. References

- [W3C DOM Specification — MutationObserver](https://dom.spec.whatwg.org/#mutation-observers)

