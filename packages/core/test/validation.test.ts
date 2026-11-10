/**
 * @file validation.test.ts
 * @package @lucentra/core
 * @description Manifest validation, domain normalization, and structural bounds tests.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { LucentraError } from "../src/errors.js";
import {
  MAX_MANIFEST_RESOURCE_COUNT,
  normalizeDomain,
  validateReleaseManifest,
  validateResourcePath,
} from "../src/validation.js";

const VALID_SAMPLE_MANIFEST = {
  schemaVersion: "LUCENTRA-Manifest-v0.1",
  domain: "example.com",
  version: "0.1.0",
  createdAt: 1700000000,
  expiresAt: 1799999999,
  resources: [
    {
      path: "/bundle.js",
      size: 30,
      sha256: "sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1",
      type: "script",
    },
  ],
};

test("normalizeDomain: Normalizes schemes, ports, and uppercase chars", () => {
  assert.equal(normalizeDomain("https://APP.Uniswap.org/path"), "app.uniswap.org");
  assert.equal(normalizeDomain("HTTP://EXAMPLE.COM:8080/"), "example.com");
  assert.equal(normalizeDomain("sub.domain.co.uk."), "sub.domain.co.uk");
  assert.equal(normalizeDomain("  my-site.org  "), "my-site.org");
});

test("normalizeDomain: Rejects invalid or dangerous domains", () => {
  assert.throws(
    () => normalizeDomain(""),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_DOMAIN_FORMAT"
  );

  assert.throws(
    () => normalizeDomain("invalid_domain!.com"),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_DOMAIN_FORMAT"
  );
});

test("validateResourcePath: Enforces leading slash and rejects path traversal", () => {
  assert.ok(validateResourcePath("/static/js/main.js"));
  assert.ok(!validateResourcePath("static/js/main.js")); // missing leading slash
  assert.ok(!validateResourcePath("/../etc/passwd")); // path traversal
  assert.ok(!validateResourcePath("/static/../secret.js"));
  assert.ok(!validateResourcePath("/static/./file.js"));
  assert.ok(!validateResourcePath("/static\\bundle.js")); // backslash
});

test("validateReleaseManifest: Accepts valid sample manifest", () => {
  const validated = validateReleaseManifest(VALID_SAMPLE_MANIFEST);
  assert.equal(validated.schemaVersion, "LUCENTRA-Manifest-v0.1");
  assert.equal(validated.domain, "example.com");
  assert.equal(validated.version, "0.1.0");
  assert.equal(validated.resources.length, 1);
});

test("validateReleaseManifest: Rejects unsupported schemaVersion", () => {
  const invalid = { ...VALID_SAMPLE_MANIFEST, schemaVersion: "LUCENTRA-Manifest-v9.9" };
  assert.throws(
    () => validateReleaseManifest(invalid),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_MANIFEST_SCHEMA"
  );
});

test("validateReleaseManifest: Rejects expiresAt <= createdAt", () => {
  const invalid = {
    ...VALID_SAMPLE_MANIFEST,
    createdAt: 1700000000,
    expiresAt: 1699999999, // prior to creation
  };
  assert.throws(
    () => validateReleaseManifest(invalid),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_TEMPORAL_RANGE"
  );
});

test("validateReleaseManifest: Rejects duplicate resource paths", () => {
  const invalid = {
    ...VALID_SAMPLE_MANIFEST,
    resources: [
      {
        path: "/bundle.js",
        size: 30,
        sha256: "sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1",
        type: "script",
      },
      {
        path: "/bundle.js", // duplicate
        size: 50,
        sha256: "sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1",
        type: "script",
      },
    ],
  };
  assert.throws(
    () => validateReleaseManifest(invalid),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_MANIFEST_SCHEMA"
  );
});

test("validateResourcePath: Rejects protocol-relative URLs, query strings, and fragments", () => {
  assert.ok(!validateResourcePath("//evil.com/payload.js"));
  assert.ok(!validateResourcePath("/bundle.js?v=123"));
  assert.ok(!validateResourcePath("/bundle.js#hash"));
});

test("normalizeDomain: Rejects numeric TLDs (IPv4 addresses) and over-length domains", () => {
  assert.throws(
    () => normalizeDomain("127.0.0.1"),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_DOMAIN_FORMAT"
  );
  assert.throws(
    () => normalizeDomain("192.168.1.1"),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_DOMAIN_FORMAT"
  );
  // Domain > 253 characters
  const tooLong = "a".repeat(60) + "." + "b".repeat(60) + "." + "c".repeat(60) + "." + "d".repeat(65) + ".com";
  assert.throws(
    () => normalizeDomain(tooLong),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_DOMAIN_FORMAT"
  );
});

test("validateReleaseManifest: Rejects unexpected additional properties (prototype defense)", () => {
  const invalid = {
    ...VALID_SAMPLE_MANIFEST,
    injectedKey: "malicious",
  };
  assert.throws(
    () => validateReleaseManifest(invalid),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_MANIFEST_SCHEMA"
  );

  const invalidResource = {
    ...VALID_SAMPLE_MANIFEST,
    resources: [
      {
        ...VALID_SAMPLE_MANIFEST.resources[0],
        extraKey: "evil",
      },
    ],
  };
  assert.throws(
    () => validateReleaseManifest(invalidResource),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_MANIFEST_SCHEMA"
  );
});

test("validateReleaseManifest: Accepts valid previousManifestHash and rejects invalid", () => {
  const validWithPrev = {
    ...VALID_SAMPLE_MANIFEST,
    previousManifestHash: "0xc1e5d6c7fc531240aaa94d85078f8fcef4a7407571bc13cc7586a417411259d4",
  };
  const validated = validateReleaseManifest(validWithPrev);
  assert.equal(
    validated.previousManifestHash,
    "0xc1e5d6c7fc531240aaa94d85078f8fcef4a7407571bc13cc7586a417411259d4"
  );

  const invalidPrev = {
    ...VALID_SAMPLE_MANIFEST,
    previousManifestHash: "0xinvalidhash",
  };
  assert.throws(
    () => validateReleaseManifest(invalidPrev),
    (err: unknown) => err instanceof LucentraError && err.code === "INVALID_HASH_FORMAT"
  );
});

test("validateReleaseManifest: Enforces MAX_MANIFEST_RESOURCE_COUNT limit", () => {
  const tooManyResources = Array.from({ length: MAX_MANIFEST_RESOURCE_COUNT + 1 }, (_, i) => ({
    path: `/script-${i}.js`,
    size: 10,
    sha256: "sha256:09ef5fbb033f41f426ed9f32441e763efba30c5d256c9bb56d9deddd7bff4bf1",
    type: "script",
  }));

  const invalid = {
    ...VALID_SAMPLE_MANIFEST,
    resources: tooManyResources,
  };

  assert.throws(
    () => validateReleaseManifest(invalid),
    (err: unknown) => err instanceof LucentraError && err.code === "RESOURCE_COUNT_EXCEEDED"
  );
});

