/**
 * @file tests/messages.test.ts
 * @package @lucentra/extension
 * @description Unit tests for typed messaging contracts, guards, and message routing.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { isExtensionMessage } from "../src/types/messages.js";
import { MessageRouter } from "../src/background/message-router.js";
import { VerifierEngine } from "../src/services/verifier-engine.js";
import { BadgeController } from "../src/background/badge-controller.js";
import { DEFAULT_CONFIG } from "../src/types/config.js";

test("Message Guards: validates valid extension message types", () => {
  assert.equal(isExtensionMessage({ type: "PING" }), true);
  assert.equal(
    isExtensionMessage({
      type: "CONTENT_SCRIPT_READY",
      url: "https://example.com",
      domain: "example.com",
    }),
    true
  );
  assert.equal(
    isExtensionMessage({
      type: "SCRIPTS_DISCOVERED",
      url: "https://example.com",
      domain: "example.com",
      scripts: [],
    }),
    true
  );
  assert.equal(isExtensionMessage({ type: "GET_TAB_STATE", tabId: 1 }), true);
  assert.equal(isExtensionMessage({ type: "TRIGGER_VERIFICATION" }), true);
  assert.equal(isExtensionMessage({ type: "GET_CONFIG" }), true);
  assert.equal(
    isExtensionMessage({
      type: "UPDATE_CONFIG",
      config: { autoVerify: false },
    }),
    true
  );
});

test("Message Guards: rejects malformed, null, or untyped messages", () => {
  assert.equal(isExtensionMessage(null), false);
  assert.equal(isExtensionMessage(undefined), false);
  assert.equal(isExtensionMessage("PING"), false);
  assert.equal(isExtensionMessage(123), false);
  assert.equal(isExtensionMessage({}), false);
  assert.equal(isExtensionMessage({ type: "UNKNOWN_MESSAGE_TYPE" }), false);
  assert.equal(isExtensionMessage({ type: 999 }), false);
});

test("MessageRouter: handles PING message with PONG", async () => {
  const engine = new VerifierEngine(DEFAULT_CONFIG);
  const badge = new BadgeController();
  const router = new MessageRouter(engine, badge);

  const response = await router.handleMessage({ type: "PING" }, {} as chrome.runtime.MessageSender);
  assert.equal(response.success, true);
  assert.equal(response.data, "PONG");
});

test("MessageRouter: handles GET_CONFIG and UPDATE_CONFIG", async () => {
  const engine = new VerifierEngine(DEFAULT_CONFIG);
  const badge = new BadgeController();
  const router = new MessageRouter(engine, badge);

  const getRes = await router.handleMessage({ type: "GET_CONFIG" }, {} as chrome.runtime.MessageSender);
  assert.equal(getRes.success, true);
  const cfg = getRes.data as typeof DEFAULT_CONFIG;
  assert.equal(cfg.backendApiUrl, "http://127.0.0.1:8000");

  const updateRes = await router.handleMessage(
    {
      type: "UPDATE_CONFIG",
      config: { maxResourceByteSize: 1024 * 1024 },
    },
    {} as chrome.runtime.MessageSender
  );
  assert.equal(updateRes.success, true);
  const updatedCfg = updateRes.data as typeof DEFAULT_CONFIG;
  assert.equal(updatedCfg.maxResourceByteSize, 1024 * 1024);
});
