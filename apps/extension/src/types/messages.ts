/**
 * @file types/messages.ts
 * @package @lucentra/extension
 * @description Strongly-typed message protocol for MV3 extension components.
 */

import type { DiscoveredScript } from "./resources.js";
import type { TabVerificationState } from "./verification.js";
import type { ExtensionConfig } from "./config.js";

export type MessageType =
  | "CONTENT_SCRIPT_READY"
  | "SCRIPTS_DISCOVERED"
  | "GET_TAB_STATE"
  | "TRIGGER_VERIFICATION"
  | "GET_CONFIG"
  | "UPDATE_CONFIG"
  | "PING";

export interface BaseMessage {
  type: MessageType;
}

export interface ContentScriptReadyMessage extends BaseMessage {
  type: "CONTENT_SCRIPT_READY";
  url: string;
  domain: string;
}

export interface ScriptsDiscoveredMessage extends BaseMessage {
  type: "SCRIPTS_DISCOVERED";
  url: string;
  domain: string;
  scripts: DiscoveredScript[];
}

export interface GetTabStateMessage extends BaseMessage {
  type: "GET_TAB_STATE";
  tabId?: number;
}

export interface TriggerVerificationMessage extends BaseMessage {
  type: "TRIGGER_VERIFICATION";
  tabId?: number;
}

export interface GetConfigMessage extends BaseMessage {
  type: "GET_CONFIG";
}

export interface UpdateConfigMessage extends BaseMessage {
  type: "UPDATE_CONFIG";
  config: Partial<ExtensionConfig>;
}

export interface PingMessage extends BaseMessage {
  type: "PING";
}

export type ExtensionMessage =
  | ContentScriptReadyMessage
  | ScriptsDiscoveredMessage
  | GetTabStateMessage
  | TriggerVerificationMessage
  | GetConfigMessage
  | UpdateConfigMessage
  | PingMessage;

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type TabStateResponse = MessageResponse<TabVerificationState>;
export type ConfigResponse = MessageResponse<ExtensionConfig>;

/** Type guard for generic extension message */
export function isExtensionMessage(msg: unknown): msg is ExtensionMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const candidate = msg as { type?: unknown };
  if (typeof candidate.type !== "string") return false;
  return [
    "CONTENT_SCRIPT_READY",
    "SCRIPTS_DISCOVERED",
    "GET_TAB_STATE",
    "TRIGGER_VERIFICATION",
    "GET_CONFIG",
    "UPDATE_CONFIG",
    "PING",
  ].includes(candidate.type);
}
