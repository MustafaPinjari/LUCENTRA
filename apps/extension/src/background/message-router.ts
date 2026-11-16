/**
 * @file background/message-router.ts
 * @package @lucentra/extension
 * @description Central message dispatcher handling typed communication between components.
 */

import type { ExtensionMessage, MessageResponse } from "../types/messages.js";
import type { DiscoveredScript } from "../types/resources.js";
import type { TabVerificationState } from "../types/verification.js";
import { loadConfig, saveConfig, getTabVerificationState, saveTabVerificationState } from "../shared/storage.js";
import { VerifierEngine } from "../services/verifier-engine.js";
import { BadgeController } from "./badge-controller.js";

export class MessageRouter {
  private verifierEngine: VerifierEngine;
  private badgeController: BadgeController;
  private tabScripts = new Map<number, { url: string; scripts: DiscoveredScript[] }>();

  constructor(verifierEngine: VerifierEngine, badgeController: BadgeController) {
    this.verifierEngine = verifierEngine;
    this.badgeController = badgeController;
  }

  public async handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse<unknown>> {
    switch (message.type) {
      case "PING":
        return { success: true, data: "PONG" };

      case "CONTENT_SCRIPT_READY": {
        const tabId = sender.tab?.id;
        if (tabId) {
          this.tabScripts.set(tabId, { url: message.url, scripts: [] });
        }
        return { success: true };
      }

      case "SCRIPTS_DISCOVERED": {
        const tabId = sender.tab?.id;
        if (!tabId) {
          return { success: false, error: "No sender tab ID found" };
        }

        this.tabScripts.set(tabId, {
          url: message.url,
          scripts: message.scripts,
        });

        const config = await loadConfig();
        if (config.autoVerify) {
          this.executeVerification(tabId, message.url, message.scripts).catch(() => {});
        }

        return { success: true };
      }

      case "GET_TAB_STATE": {
        let tabId = message.tabId;
        if (!tabId && sender.tab?.id) {
          tabId = sender.tab.id;
        }

        // If tabId still not provided (e.g. from popup), query active tab
        if (!tabId && typeof chrome !== "undefined" && chrome.tabs) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          tabId = activeTab?.id;
        }

        if (!tabId) {
          return { success: false, error: "Unable to determine target tab" };
        }

        const state = await getTabVerificationState(tabId);
        return { success: true, data: state };
      }

      case "TRIGGER_VERIFICATION": {
        let tabId = message.tabId;
        let tabUrl = "";

        if (typeof chrome !== "undefined" && chrome.tabs) {
          if (!tabId) {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            tabId = activeTab?.id;
            tabUrl = activeTab?.url || "";
          } else {
            const tab = await chrome.tabs.get(tabId);
            tabUrl = tab?.url || "";
          }
        }

        if (!tabId) {
          return { success: false, error: "Target tab not found" };
        }

        const cached = this.tabScripts.get(tabId);
        const scripts = cached?.scripts || [];
        const url = tabUrl || cached?.url || "";

        const state = await this.executeVerification(tabId, url, scripts);
        return { success: true, data: state };
      }

      case "GET_CONFIG": {
        const config = await loadConfig();
        return { success: true, data: config };
      }

      case "UPDATE_CONFIG": {
        const updated = await saveConfig(message.config);
        this.verifierEngine.updateConfig(updated);
        return { success: true, data: updated };
      }

      default:
        return { success: false, error: "Unknown message type" };
    }
  }

  public async executeVerification(
    tabId: number,
    url: string,
    scripts: DiscoveredScript[]
  ): Promise<TabVerificationState> {
    const result = await this.verifierEngine.verifyTab(tabId, url, scripts);
    await saveTabVerificationState(tabId, result);
    this.badgeController.updateBadge(tabId, result.verificationState);
    return result;
  }

  public removeTab(tabId: number): void {
    this.tabScripts.delete(tabId);
  }
}
