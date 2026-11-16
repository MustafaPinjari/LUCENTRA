/**
 * @file background/badge-controller.ts
 * @package @lucentra/extension
 * @description Manages browser action badge text, colors, and tooltips based on verification state.
 */

import type { VerificationState } from "@lucentra/core";
import { BADGE_CONFIG } from "../shared/constants.js";

export class BadgeController {
  public updateBadge(tabId: number, state: VerificationState): void {
    if (typeof chrome === "undefined" || !chrome.action) {
      return;
    }

    const info = BADGE_CONFIG[state];
    if (!info) return;

    try {
      chrome.action.setBadgeText({ tabId, text: info.text });
      chrome.action.setBadgeBackgroundColor({ tabId, color: info.color });
      chrome.action.setTitle({ tabId, title: info.title });
    } catch {
      // Ignored in non-active tab contexts
    }
  }

  public clearBadge(tabId: number): void {
    if (typeof chrome === "undefined" || !chrome.action) {
      return;
    }
    try {
      chrome.action.setBadgeText({ tabId, text: "" });
      chrome.action.setTitle({ tabId, title: "LUCENTRA — Trust, made verifiable." });
    } catch {
      // Ignored
    }
  }
}
