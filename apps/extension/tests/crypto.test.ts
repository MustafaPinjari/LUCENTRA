/**
 * @file tests/crypto.test.ts
 * @package @lucentra/extension
 * @description Unit tests for Web Crypto SHA-256 hashing and formatting.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { computeSha256Hex, computeResourceHash } from "../src/utils/crypto.js";

test("Crypto Utils: computeSha256Hex matches known SHA-256 test vectors", async () => {
  // Empty buffer vector: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  const empty = new Uint8Array(0);
  const emptyHex = await computeSha256Hex(empty);
  assert.equal(emptyHex, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

  // String "hello world" vector: b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
  const helloBytes = new TextEncoder().encode("hello world");
  const helloHex = await computeSha256Hex(helloBytes);
  assert.equal(helloHex, "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
});

test("Crypto Utils: computeResourceHash formats with sha256: prefix", async () => {
  const bytes = new TextEncoder().encode("console.log('lucentra');");
  const formatted = await computeResourceHash(bytes);

  assert.equal(formatted.startsWith("sha256:"), true);
  assert.equal(formatted.length, 7 + 64); // "sha256:" (7) + 64 hex chars
});
