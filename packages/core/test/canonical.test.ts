/**
 * @file canonical.test.ts
 * @package @lucentra/core
 * @description RFC 8785 JSON Canonicalization Scheme (JCS) tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalizeManifest } from "../src/canonical.js";
import { LucentraError } from "../src/errors.js";

test("RFC 8785: Object key sorting by UTF-16 code units", () => {
  const unordered = {
    z: 1,
    a: 2,
    m: 3,
    b: 4,
  };
  const result = canonicalizeManifest(unordered);
  assert.equal(result, '{"a":2,"b":4,"m":3,"z":1}');
});

test("RFC 8785: Nested objects key sorting", () => {
  const nested = {
    b: { z: 1, a: 2 },
    a: { y: 10, x: 20 },
  };
  const result = canonicalizeManifest(nested);
  assert.equal(result, '{"a":{"x":20,"y":10},"b":{"a":2,"z":1}}');
});

test("RFC 8785: Array preservation and ordering", () => {
  const objWithArray = {
    items: [3, 1, 2],
    title: "test",
  };
  const result = canonicalizeManifest(objWithArray);
  assert.equal(result, '{"items":[3,1,2],"title":"test"}');
});

test("RFC 8785: Exclusion of signature field", () => {
  const objWithSig = {
    domain: "example.com",
    version: "1.0.0",
    signature: "0x1234567890abcdef",
  };
  const result = canonicalizeManifest(objWithSig);
  assert.equal(result, '{"domain":"example.com","version":"1.0.0"}');
  assert.ok(!result.includes("signature"));
});

test("RFC 8785: Handling of negative zero (-0) per ES6", () => {
  const objWithZero = {
    zero: -0,
    positiveZero: 0,
  };
  const result = canonicalizeManifest(objWithZero);
  assert.equal(result, '{"positiveZero":0,"zero":0}');
});

test("RFC 8785: Rejection of non-finite numbers (NaN, Infinity)", () => {
  assert.throws(
    () => canonicalizeManifest({ num: Number.NaN }),
    (err: unknown) => err instanceof LucentraError && err.code === "CANONICALIZATION_FAILED"
  );

  assert.throws(
    () => canonicalizeManifest({ num: Number.POSITIVE_INFINITY }),
    (err: unknown) => err instanceof LucentraError && err.code === "CANONICALIZATION_FAILED"
  );
});

test("RFC 8785: Unicode string handling and whitespace elimination", () => {
  const unicodeObj = {
    greeting: "Hello, 世界 🚀",
    spacing: "a   b",
  };
  const result = canonicalizeManifest(unicodeObj);
  assert.equal(result, '{"greeting":"Hello, 世界 🚀","spacing":"a   b"}');
});

test("RFC 8785: Deterministic repeated serialization", () => {
  const complex = {
    resources: [
      { path: "/b.js", size: 100 },
      { path: "/a.js", size: 200 },
    ],
    domain: "test.com",
    active: true,
  };
  const res1 = canonicalizeManifest(complex);
  const res2 = canonicalizeManifest(complex);
  assert.equal(res1, res2);
});
