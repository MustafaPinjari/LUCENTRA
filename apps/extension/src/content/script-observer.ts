/**
 * @file content/script-observer.ts
 * @package @lucentra/extension
 * @description MutationObserver watching for dynamically added script elements and src mutations.
 */

import type { DiscoveredScript } from "../types/resources.js";
import { scanDocumentScripts } from "./dom-scanner.js";

export type ScriptDiscoveryCallback = (scripts: DiscoveredScript[]) => void;

export class ScriptObserver {
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private debounceMs: number;
  private onDiscovery: ScriptDiscoveryCallback;
  private lastCount = 0;

  constructor(onDiscovery: ScriptDiscoveryCallback, debounceMs = 500) {
    this.onDiscovery = onDiscovery;
    this.debounceMs = debounceMs;
  }

  public start(): void {
    if (this.observer) return;

    // Run initial scan immediately
    this.triggerScan();

    // Create MutationObserver
    this.observer = new MutationObserver((mutations) => {
      let scriptRelatedMutation = false;

      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              if (el.tagName === "SCRIPT" || el.querySelector("script")) {
                scriptRelatedMutation = true;
                break;
              }
            }
          }
        } else if (mutation.type === "attributes") {
          if (mutation.attributeName === "src" && mutation.target.nodeName === "SCRIPT") {
            scriptRelatedMutation = true;
            break;
          }
        }
        if (scriptRelatedMutation) break;
      }

      if (scriptRelatedMutation) {
        this.scheduleScan();
      }
    });

    const target = document.documentElement || document;
    this.observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
  }

  public stop(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private scheduleScan(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.triggerScan();
    }, this.debounceMs);
  }

  public triggerScan(): void {
    const scripts = scanDocumentScripts();
    if (scripts.length !== this.lastCount) {
      this.lastCount = scripts.length;
      this.onDiscovery(scripts);
    }
  }
}
