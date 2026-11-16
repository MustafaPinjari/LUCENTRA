/**
 * @file types/config.ts
 * @package @lucentra/extension
 * @description Extension runtime configuration and preferences.
 */

export interface ExtensionConfig {
  backendApiUrl: string;
  rpcUrl: string;
  easContractAddress?: string;
  publisherRegistryAddress?: string;
  maxResourceByteSize: number;
  fetchTimeoutMs: number;
  observationDebounceMs: number;
  allowLocalhost: boolean;
  autoVerify: boolean;
}

export const DEFAULT_CONFIG: ExtensionConfig = {
  backendApiUrl: "http://127.0.0.1:8000",
  rpcUrl: "http://127.0.0.1:8545",
  maxResourceByteSize: 5 * 1024 * 1024, // 5 MiB maximum per script
  fetchTimeoutMs: 10000, // 10 seconds timeout
  observationDebounceMs: 500, // 500ms debounce for DOM mutations
  allowLocalhost: true, // Allow 127.0.0.1/localhost in development
  autoVerify: true,
};
