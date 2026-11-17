/**
 * @file background/service-worker.ts
 * @package @lucentra/extension
 * @description Manifest V3 Background Service Worker lifecycle, listeners, and initialization.
 */

import { loadConfig, clearTabVerificationState } from "../shared/storage.js";
import { isExtensionMessage } from "../types/messages.js";
import { VerifierEngine } from "../services/verifier-engine.js";
import { BadgeController } from "./badge-controller.js";
import { MessageRouter } from "./message-router.js";

export async function initServiceWorker(): Promise<MessageRouter> {
  const config = await loadConfig();
  const verifierEngine = new VerifierEngine(config);
  const badgeController = new BadgeController();
  const messageRouter = new MessageRouter(verifierEngine, badgeController);

  // Message listener
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
      if (!isExtensionMessage(rawMessage)) {
        return false;
      }

      // Handle async message dispatch
      messageRouter
        .handleMessage(rawMessage, sender)
        .then((response) => sendResponse(response))
        .catch((err) => {
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        });

      return true; // Keep channel open for async response
    });
  }

  // Tab lifecycle listeners
  if (typeof chrome !== "undefined" && chrome.tabs) {
    chrome.tabs.onRemoved?.addListener((tabId) => {
      messageRouter.removeTab(tabId);
      clearTabVerificationState(tabId).catch(() => {});
    });

    chrome.tabs.onUpdated?.addListener((tabId, changeInfo) => {
      if (changeInfo.status === "loading" && changeInfo.url) {
        // Tab navigated to new URL - invalidate in-flight verification sessions & clear previous badge & state
        messageRouter.invalidateTabSession(tabId);
        badgeController.clearBadge(tabId);
        clearTabVerificationState(tabId).catch(() => {});
      }
    });
  }

  return messageRouter;
}
