/**
 * @file hash.test.ts
 * @package @lucentra/core
 * @description Cryptographic SHA-256 hashing tests for manifests and resources.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { LucentraError } from "../src/errors.js";
import {
  formatResourceHash,
  hashAndFormatResource,
  hashManifest,
  hashResourceBytes,
} from "../src/hash.js";

test("hashResourceBytes: Official FIPS 180-4 standard test vectors", () => {
  // Vector 1: empty string
  const emptyDigest = hashResourceBytes("");
  assert.equal(emptyDigest, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

  // Vector 2: "abc"
  const abcDigest = hashResourceBytes("abc");
  assert.equal(abcDigest, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

  // Vector 3: 448-bit message "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
  const longMsg = "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq";
  const longDigest = hashResourceBytes(longMsg);
  assert.equal(longDigest, "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
});

test("hashResourceBytes: Handles large 2 MiB binary input correctly", () => {
  const largeBuffer = new Uint8Array(2 * 1024 * 1024);
  largeBuffer.fill(0xaa);
  const digest = hashResourceBytes(largeBuffer);
  assert.equal(digest.length, 64);
  assert.ok(/^[a-f0-9]{64}$/.test(digest));
});

test("hashResourceBytes: Computes correct SHA-256 for string", () => {
  const content = 'console.log("Hello, LUCENTRA!");\n';
  const digest = hashResourceBytes(content);
  // FIPS 180-4 SHA-256 digest
  assert.equal(digest, "09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1");
});

test("hashResourceBytes: Computes correct SHA-256 for Uint8Array", () => {
  const bytes = new TextEncoder().encode('console.log("Hello, LUCENTRA!");\n');
  const digest = hashResourceBytes(bytes);
  assert.equal(digest, "09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1");
});

test("hashResourceBytes: Computes correct SHA-256 for ArrayBuffer", () => {
  const bytes = new TextEncoder().encode('console.log("Hello, LUCENTRA!");\n');
  const digest = hashResourceBytes(bytes.buffer);
  assert.equal(digest, "09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1");
});

test("formatResourceHash: Formats 64-hex string correctly", () => {
  const rawHex = "09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1";
  const formatted = formatResourceHash(rawHex);
  assert.equal(
    formatted,
    "sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1"
  );

  // Idempotency with existing sha256: prefix
  assert.equal(formatResourceHash(formatted), formatted);
});

test("formatResourceHash: Rejects invalid length or non-hex string", () => {
  assert.throws(
    () => formatResourceHash("invalid-hash"),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_HASH_FORMAT"
  );

  assert.throws(
    () => formatResourceHash("09ef5f"), // too short
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_HASH_FORMAT"
  );
});

test("hashAndFormatResource: Hashes and formats in single step", () => {
  const content = 'console.log("Hello, LUCENTRA!");\n';
  const result = hashAndFormatResource(content);
  assert.equal(
    result,
    "sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1"
  );
});

test("hashManifest: Test Vector 2 official manifest hash", () => {
  const canonical =
    '{"createdAt":1700000000,"domain":"example.com","expiresAt":1799999999,"resources":[{"path":"/bundle.js","sha256":"sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1","size":33,"type":"script"}],"schemaVersion":"LUCENTRA-Manifest-v0.1","version":"0.1.0"}';
  const hash = hashManifest(canonical);
  assert.equal(hash, "0xc1e5d6c7fc531240aaa94d85078f8fcef4a7407571bc13cc7586a417411259d4");
});

test("hashManifest: Computes 0x-prefixed 32-byte digest", () => {
  const canonical = '{"domain":"example.com","version":"1.0.0"}';
  const hash = hashManifest(canonical);
  assert.ok(hash.startsWith("0x"));
  assert.equal(hash.length, 66); // '0x' + 64 hex chars
});

test("hashManifest: Rejects empty or invalid string", () => {
  assert.throws(
    () => hashManifest(""),
    (err: unknown) => err instanceof LucentraError && err.code === "CANONICALIZATION_FAILED"
  );
});
