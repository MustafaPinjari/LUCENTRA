/**
 * @file shared/storage.ts
 * @package @lucentra/extension
 * @description Typed storage manager with chrome.storage.local persistence and memory fallback.
 */

import { DEFAULT_CONFIG, type ExtensionConfig } from "../types/config.js";
import type { TabVerificationState } from "../types/verification.js";
import { STORAGE_KEYS } from "./constants.js";

class MemoryStorageFallback {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

const memoryStore = new MemoryStorageFallback();

function hasChromeStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    chrome.storage !== undefined &&
    chrome.storage.local !== undefined
  );
}

export async function loadConfig(): Promise<ExtensionConfig> {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.CONFIG, (res) => {
        const stored = res[STORAGE_KEYS.CONFIG];
        if (stored && typeof stored === "object") {
          resolve({ ...DEFAULT_CONFIG, ...stored });
        } else {
          resolve({ ...DEFAULT_CONFIG });
        }
      });
    });
  }
  const inMem = await memoryStore.get<ExtensionConfig>(STORAGE_KEYS.CONFIG);
  return inMem ? { ...DEFAULT_CONFIG, ...inMem } : { ...DEFAULT_CONFIG };
}

export async function saveConfig(updates: Partial<ExtensionConfig>): Promise<ExtensionConfig> {
  const current = await loadConfig();
  const updated: ExtensionConfig = { ...current, ...updates };

  if (hasChromeStorage()) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: updated }, () => {
        resolve();
      });
    });
  } else {
    await memoryStore.set(STORAGE_KEYS.CONFIG, updated);
  }

  return updated;
}

export async function saveTabVerificationState(
  tabId: number,
  state: TabVerificationState
): Promise<void> {
  const key = `${STORAGE_KEYS.TAB_CACHE_PREFIX}${tabId}`;
  if (hasChromeStorage()) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [key]: state }, () => resolve());
    });
  } else {
    await memoryStore.set(key, state);
  }
}

export async function getTabVerificationState(
  tabId: number
): Promise<TabVerificationState | undefined> {
  const key = `${STORAGE_KEYS.TAB_CACHE_PREFIX}${tabId}`;
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (res) => {
        resolve(res[key] as TabVerificationState | undefined);
      });
    });
  }
  return memoryStore.get<TabVerificationState>(key);
}

export async function clearTabVerificationState(tabId: number): Promise<void> {
  const key = `${STORAGE_KEYS.TAB_CACHE_PREFIX}${tabId}`;
  if (hasChromeStorage()) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove(key, () => resolve());
    });
  } else {
    await memoryStore.remove(key);
  }
}
