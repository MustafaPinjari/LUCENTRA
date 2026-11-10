/**
 * @file canonical.test.ts
 * @package @lucentra/core
 * @description RFC 8785 JSON Canonicalization Scheme (JCS) tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalizeManifest } from "../src/canonical.js";
import { LucentraError } from "../src/errors.js";

test("RFC 8785: Official Appendix A.1 key sorting test vector", () => {
  // Official RFC 8785 Appendix A.1 test vector
  // UTF-16 code units: "01" (0x30, 0x31) < "1" (0x31) < "10" (0x31, 0x30)
  const input = {
    "10": "ten",
    "1": "one",
    "01": "zero one",
  };
  const result = canonicalizeManifest(input);
  assert.equal(result, '{"01":"zero one","1":"one","10":"ten"}');
});

test("RFC 8785: Official Appendix A.2 number serialization test vectors", () => {
  // Official RFC 8785 Appendix A.2 test vectors
  const numbers = {
    zero: 0,
    negZero: -0,
    big: 1e23,
    small: 1e-7,
    frac: 0.125,
  };
  const result = canonicalizeManifest(numbers);
  assert.equal(
    result,
    '{"big":1e+23,"frac":0.125,"negZero":0,"small":1e-7,"zero":0}'
  );
});

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

test("RFC 8785: Rejection of lone surrogates (ill-formed UTF-16)", () => {
  assert.throws(
    () => canonicalizeManifest({ badString: "\uD800" }),
    (err: unknown) => err instanceof LucentraError && err.code === "CANONICALIZATION_FAILED"
  );

  assert.throws(
    () => canonicalizeManifest({ badString: "\uDFFF" }),
    (err: unknown) => err instanceof LucentraError && err.code === "CANONICALIZATION_FAILED"
  );
});

test("RFC 8785: Root-level signature exclusion vs nested signature preservation", () => {
  const payload = {
    domain: "example.com",
    signature: "0xrootSignature",
    metadata: {
      signature: "0xnestedSignatureShouldBePreserved",
    },
  };
  const result = canonicalizeManifest(payload);
  assert.equal(
    result,
    '{"domain":"example.com","metadata":{"signature":"0xnestedSignatureShouldBePreserved"}}'
  );
});

test("RFC 8785: Standard escape sequences and whitespace elimination", () => {
  const escapes = {
    text: "Line1\nLine2\tTabbed\r\nCRLF\"Quoted\"\\Backslash\\",
  };
  const result = canonicalizeManifest(escapes);
  assert.equal(
    result,
    '{"text":"Line1\\nLine2\\tTabbed\\r\\nCRLF\\"Quoted\\"\\\\Backslash\\\\"}'
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

