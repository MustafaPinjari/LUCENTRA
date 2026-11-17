/**
 * @file types/config.ts
 * @package @lucentra/extension
 * @description Extension runtime configuration and preferences.
 */

import type { Address } from "@lucentra/core";

export const ANVIL_LOCAL_SIGNATURE_VERIFIER: Address =
  "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

export interface ExtensionConfig {
  backendApiUrl: string;
  rpcUrl: string;
  easContractAddress?: string;
  publisherRegistryAddress?: string;
  verifyingContractAddress?: Address;
  maxResourceByteSize: number;
  fetchTimeoutMs: number;
  observationDebounceMs: number;
  allowLocalhost: boolean;
  autoVerify: boolean;
}

export const DEFAULT_CONFIG: ExtensionConfig = {
  backendApiUrl: "http://127.0.0.1:8000",
  rpcUrl: "http://127.0.0.1:8545",
  verifyingContractAddress: ANVIL_LOCAL_SIGNATURE_VERIFIER,
  maxResourceByteSize: 5 * 1024 * 1024, // 5 MiB maximum per script
  fetchTimeoutMs: 10000, // 10 seconds timeout
  observationDebounceMs: 500, // 500ms debounce for DOM mutations
  allowLocalhost: true, // Allow 127.0.0.1/localhost in development
  autoVerify: true,
};
