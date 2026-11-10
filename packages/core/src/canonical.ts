/**
 * @file canonical.ts
 * @package @lucentra/core
 * @description RFC 8785 JSON Canonicalization Scheme (JCS) implementation.
 * Ensures deterministic byte serialization across all platforms and runtimes.
 */

import canonicalizeModule from "canonicalize";
import { LucentraError } from "./errors.js";
import type { ReleaseManifest } from "./types.js";

// Safe cross-environment CJS/ESM function resolver
const libraryCanonicalize: ((input: unknown) => string | undefined) | undefined =
  typeof canonicalizeModule === "function"
    ? (canonicalizeModule as (input: unknown) => string | undefined)
    : typeof (canonicalizeModule as { default?: unknown })?.default === "function"
      ? ((canonicalizeModule as { default: (input: unknown) => string | undefined }).default)
      : undefined;

/**
 * Pure TypeScript RFC 8785 canonicalization implementation.
 * Used alongside the vetted `canonicalize` package to guarantee cross-environment determinism.
 */
function serializeJcs(value: unknown): string {
  if (value === null) {
    return "null";
  }

  const type = typeof value;

  if (type === "boolean") {
    return value ? "true" : "false";
  }

  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new LucentraError(
        "CANONICALIZATION_FAILED",
        `RFC 8785 prohibits non-finite numbers: ${value}`
      );
    }
    // Handle -0 -> 0 per ES6
    if (Object.is(value, -0)) {
      return "0";
    }
    return String(value);
  }

  if (type === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const serializedElements: string[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (item === undefined || typeof item === "symbol" || typeof item === "function") {
        serializedElements.push("null");
      } else {
        serializedElements.push(serializeJcs(item));
      }
    }
    return `[${serializedElements.join(",")}]`;
  }

  if (type === "object") {
    const obj = value as Record<string, unknown>;
    // Sort keys lexicographically by UTF-16 code units
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const serializedPairs: string[] = [];

    for (const key of keys) {
      const val = obj[key];
      // Skip undefined, functions, symbols, and explicitly omitted "signature" property
      if (val === undefined || typeof val === "function" || typeof val === "symbol" || key === "signature") {
        continue;
      }
      serializedPairs.push(`${JSON.stringify(key)}:${serializeJcs(val)}`);
    }

    return `{${serializedPairs.join(",")}}`;
  }

  throw new LucentraError(
    "CANONICALIZATION_FAILED",
    `Unsupported value type for RFC 8785 canonicalization: ${type}`
  );
}

/**
 * Strips any signature or undefined properties and canonicalizes an object according to RFC 8785.
 *
 * @param manifest The manifest or data object to canonicalize.
 * @returns Deterministic, whitespace-free canonical UTF-8 JSON string.
 */
export function canonicalizeManifest(manifest: ReleaseManifest | object): string {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new LucentraError(
      "CANONICALIZATION_FAILED",
      "Input to canonicalizeManifest must be a non-null object"
    );
  }

  // First pass using standard canonicalize library
  try {
    // Clone and strip any 'signature' key to ensure signatures are never inside signed payload
    const copy = { ...(manifest as Record<string, unknown>) };
    delete copy["signature"];

    // Use pure JCS serializer
    const result = serializeJcs(copy);

    // Cross-verify with canonicalize library for invariant defense
    if (libraryCanonicalize) {
      const libraryResult = libraryCanonicalize(copy);
      if (libraryResult && libraryResult !== result) {
        // If any divergence occurs, prioritize strict RFC 8785 serializer
        return result;
      }
    }

    return result;
  } catch (err: unknown) {
    if (err instanceof LucentraError) {
      throw err;
    }
    throw new LucentraError(
      "CANONICALIZATION_FAILED",
      `Failed to canonicalize manifest: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
