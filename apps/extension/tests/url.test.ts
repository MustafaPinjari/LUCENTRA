/**
 * @file tests/url.test.ts
 * @package @lucentra/extension
 * @description Unit tests for URL validation, path resolution, and SSRF blocking rules.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  isWebScheme,
  extractDomainFromUrl,
  resolveResourcePath,
  isPrivateOrBlockedHost,
} from "../src/utils/url.js";

test("URL Utils: isWebScheme verifies valid HTTP and HTTPS protocols", () => {
  assert.equal(isWebScheme("http://example.com"), true);
  assert.equal(isWebScheme("https://example.com/app.js"), true);
  assert.equal(isWebScheme("https://sub.domain.org:8080/path"), true);

  assert.equal(isWebScheme("chrome://extensions"), false);
  assert.equal(isWebScheme("about:blank"), false);
  assert.equal(isWebScheme("file:///C:/test.js"), false);
  assert.equal(isWebScheme("javascript:alert(1)"), false);
  assert.equal(isWebScheme("data:text/javascript;base64,AAA"), false);
  assert.equal(isWebScheme("blob:https://example.com/uuid"), false);
});

test("URL Utils: extractDomainFromUrl normalizes domains properly", () => {
  assert.equal(extractDomainFromUrl("https://example.com/foo/bar"), "example.com");
  assert.equal(extractDomainFromUrl("http://EXAMPLE.COM:8080/path"), "example.com");
  assert.equal(extractDomainFromUrl("https://sub.domain.org/"), "sub.domain.org");
  assert.equal(extractDomainFromUrl("chrome://settings"), null);
  assert.equal(extractDomainFromUrl("not-a-url"), null);
});

test("URL Utils: resolveResourcePath resolves relative and absolute script paths", () => {
  const base = "https://example.com/app/index.html";

  const rel1 = resolveResourcePath(base, "main.js");
  assert.equal(rel1.isValid, true);
  assert.equal(rel1.absoluteUrl, "https://example.com/app/main.js");
  assert.equal(rel1.path, "/app/main.js");

  const rel2 = resolveResourcePath(base, "/static/bundle.js");
  assert.equal(rel2.isValid, true);
  assert.equal(rel2.absoluteUrl, "https://example.com/static/bundle.js");
  assert.equal(rel2.path, "/static/bundle.js");

  const rel3 = resolveResourcePath(base, "../vendor/lib.js");
  assert.equal(rel3.isValid, true);
  assert.equal(rel3.absoluteUrl, "https://example.com/vendor/lib.js");
  assert.equal(rel3.path, "/vendor/lib.js");

  const invalid = resolveResourcePath(base, "data:text/javascript,console.log()");
  assert.equal(invalid.isValid, false);
});

test("SSRF Prevention: blocks private IP ranges and cloud metadata", () => {
  // Cloud metadata endpoint - MUST ALWAYS BE BLOCKED
  assert.equal(isPrivateOrBlockedHost("169.254.169.254", false), true);
  assert.equal(isPrivateOrBlockedHost("169.254.169.254", true), true); // Even in dev!

  // RFC 1918 Private IPv4
  assert.equal(isPrivateOrBlockedHost("10.0.0.1", false), true);
  assert.equal(isPrivateOrBlockedHost("172.16.5.10", false), true);
  assert.equal(isPrivateOrBlockedHost("192.168.1.1", false), true);
  assert.equal(isPrivateOrBlockedHost("169.254.1.1", false), true);

  // Loopback behavior
  assert.equal(isPrivateOrBlockedHost("127.0.0.1", false), true);
  assert.equal(isPrivateOrBlockedHost("localhost", false), true);
  assert.equal(isPrivateOrBlockedHost("127.0.0.1", true), false); // Allowed in dev
  assert.equal(isPrivateOrBlockedHost("localhost", true), false); // Allowed in dev

  // Public domain
  assert.equal(isPrivateOrBlockedHost("example.com", false), false);
  assert.equal(isPrivateOrBlockedHost("cdn.cloudflare.com", false), false);
});
