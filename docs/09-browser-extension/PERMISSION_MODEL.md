# Permission Model & Least Privilege — LUCENTRA Extension

**Document ID:** LUC-EXT-003  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document justifies every permission requested by the LUCENTRA Chrome Extension according to the principle of least privilege, explaining why each permission is required and how user privacy is preserved.

---

## 2. Permissions Justification Matrix

| Permission | Scope | Justification | Privacy Guarantee |
| :--- | :--- | :--- | :--- |
| **`storage`** | Local extension state | Required to store `chrome.storage.local` cache for manifests and verified EAS attestations. | Stored strictly on device; never transmitted or synchronized. |
| **`activeTab`** | Current foreground tab | Grants temporary permission to read tab URL and update the action toolbar badge when user views a site. | No persistent background tracking across arbitrary tabs. |
| **`host_permissions`** | `https://api.lucentra.io/*` and trusted EVM RPCs | Required for background service worker to fetch release manifests and verify on-chain EAS attestations. | Restricted strictly to LUCENTRA API and public Ethereum RPC gateways. |

---

## 3. Rejected Invasive Permissions

1. **`webRequestBlocking`:** Deprecated in MV3; introduces privacy risks and potential network stalling.
2. **`<all_urls>` Host Permissions:** LUCENTRA uses content script matching for script observation, but avoids blanket background network intercept permissions.
3. **`cookies` / `webNavigation`:** Explicitly excluded to protect user anonymity and comply with Chrome Web Store single-purpose policies.

---

## 4. Related Documents

- [docs/09-browser-extension/MANIFEST_V3.md](MANIFEST_V3.md)
- [docs/11-security/PRIVACY_MODEL.md](../11-security/PRIVACY_MODEL.md)

---

## 5. References

- [Chrome Web Store Permissions Policy](https://developer.chrome.com/docs/webstore/program-policies/permissions/)

