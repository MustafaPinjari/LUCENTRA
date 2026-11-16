/**
 * @file content/index.ts
 * @package @lucentra/extension
 * @description Injected content script entry point for DOM inspection and script discovery.
 */

import { extractDomainFromUrl, isWebScheme } from "../utils/url.js";
import { ScriptObserver } from "./script-observer.js";
import type {
  ContentScriptReadyMessage,
  ScriptsDiscoveredMessage,
} from "../types/messages.js";
import type { DiscoveredScript } from "../types/resources.js";

function initContentScript(): void {
  const currentUrl = window.location.href;

  // Ignore non-web schemes (chrome://, about:, etc.)
  if (!isWebScheme(currentUrl)) {
    return;
  }

  const domain = extractDomainFromUrl(currentUrl);
  if (!domain) {
    return;
  }

  // Send ready notification to background
  const readyMsg: ContentScriptReadyMessage = {
    type: "CONTENT_SCRIPT_READY",
    url: currentUrl,
    domain,
  };

  try {
    chrome.runtime.sendMessage(readyMsg);
  } catch {
    // Background might not be listening yet, safe to ignore
  }

  // Start script observer
  const observer = new ScriptObserver((scripts: DiscoveredScript[]) => {
    const discoveredMsg: ScriptsDiscoveredMessage = {
      type: "SCRIPTS_DISCOVERED",
      url: currentUrl,
      domain,
      scripts,
    };
    try {
      chrome.runtime.sendMessage(discoveredMsg);
    } catch {
      // Ignored
    }
  }, 400);

  // If DOM is ready, start immediately; otherwise wait for interactive/DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      observer.start();
    });
  } else {
    observer.start();
  }
}

initContentScript();
