# Browser Extension Testing (Playwright / Puppeteer) — LUCENTRA

**Document ID:** LUC-TST-006  
**Version:** 0.1.0  
**Status:** APPROVED  
**Last Updated:** 2026-11-09  

---

## 1. Purpose

This document specifies the end-to-end browser automation harness for testing the Chrome Extension inside headless and headed Chromium environments using Playwright.

---

## 2. Playwright Extension Test Harness (`apps/extension/tests/e2e/`)

```typescript
import { test, expect, chromium } from "@playwright/test";
import path from "path";

test("Extension flags tampered script with red alert badge", async () => {
  const pathToExtension = path.join(__dirname, "../../dist");
  const userDataDir = "/tmp/test-user-data-dir";

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  const page = await context.newPage();
  
  // Navigate to mock site with tampered script
  await page.goto("http://localhost:3000/tampered-app");

  // Inspect extension service worker badge
  let [background] = context.serviceWorkers();
  if (!background) background = await context.waitForEvent("serviceworker");

  // Evaluate badge text
  const badgeText = await background.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return await chrome.action.getBadgeText({ tabId: tab.id! });
  });

  expect(badgeText).toBe("!");
  await context.close();
});
```

---

## 3. Related Documents

- [docs/09-browser-extension/VERIFICATION_WORKFLOW.md](../09-browser-extension/VERIFICATION_WORKFLOW.md)
- [docs/12-testing/TESTING_STRATEGY.md](TESTING_STRATEGY.md)

---

## 4. References

- [Playwright Chrome Extension Testing](https://playwright.dev/docs/chrome-extensions)
