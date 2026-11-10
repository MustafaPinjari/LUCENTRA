/**
 * @file errors.ts
 * @package @lucentra/core
 * @description Standardized error classes and error codes for the LUCENTRA verification engine.
 */

import type { VerificationErrorCode } from "./types.js";

/**
 * Base custom error class for all LUCENTRA protocol and verification errors.
 */
export class LucentraError extends Error {
  public readonly code: VerificationErrorCode;
  public readonly details?: unknown;

  constructor(code: VerificationErrorCode, message: string, details?: unknown) {
    super(`[LUCENTRA:${code}] ${message}`);
    this.name = "LucentraError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, LucentraError.prototype);
  }

  /**
   * Serializes error to a structured plain object for API transmission.
   */
  public toJSON(): { code: VerificationErrorCode; message: string; details?: unknown } {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Type guard checking if an unknown error is an instance of LucentraError.
 */
export function isLucentraError(error: unknown): error is LucentraError {
  return error instanceof LucentraError;
}

