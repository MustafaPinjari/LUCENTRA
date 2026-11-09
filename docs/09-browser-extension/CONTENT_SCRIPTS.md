# Content Scripts & DOM Script Interception — LUCENTRA

**Document ID:** LUC-EXT-004  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document details the implementation of content scripts in the LUCENTRA Chrome Extension, focusing on DOM interception of script elements using `MutationObserver` and message passing to background service workers.

---

## 2. Content Script Implementation (`apps/extension/src/content.ts`)

```typescript
// Executed at document_start in Isolated World
(function initLucentraInspector() {
  const observedUrls = new Set<string>();

  // 1. Initial Domain Notification to Background Worker
  const currentDomain = window.location.hostname;
  chrome.runtime.sendMessage({
    type: "LUCENTRA_INIT_PAGE",
    payload: { domain: currentDomain, url: window.location.href }
  });

  // 2. Intercept Existing Scripts
  function processScriptElement(script: HTMLScriptElement) {
    const src = script.src;
    if (!src || observedUrls.has(src)) return;
    observedUrls.add(src);

    // Dispatch to background for hashing & manifest check
    chrome.runtime.sendMessage({
      type: "LUCENTRA_SCRIPT_FOUND",
      payload: { src, domain: currentDomain }
    });
  }

  // 3. Scan scripts currently in DOM
  document.querySelectorAll("script").forEach(processScriptElement);

  // 4. Attach MutationObserver for Dynamically Injected Scripts
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeName === "SCRIPT") {
          processScriptElement(node as HTMLScriptElement);
        } else if (node.hasChildNodes && (node as HTMLElement).querySelectorAll) {
          (node as HTMLElement).querySelectorAll("script").forEach(processScriptElement);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
```

---

## 3. Related Documents

- [docs/09-browser-extension/RESOURCE_INSPECTION.md](RESOURCE_INSPECTION.md)
- [docs/09-browser-extension/SERVICE_WORKER.md](SERVICE_WORKER.md)

---

## 4. References

- [MDN MutationObserver API](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
