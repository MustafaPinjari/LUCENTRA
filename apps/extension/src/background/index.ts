/**
 * @file background/index.ts
 * @package @lucentra/extension
 * @description Background service worker entry point.
 */

import { initServiceWorker } from "./service-worker.js";

initServiceWorker().catch((err) => {
  console.error("[LUCENTRA Service Worker] Initialization failed:", err);
});
