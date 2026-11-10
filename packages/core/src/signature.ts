/**
 * @file signature.ts
 * @package @lucentra/core
 * @description EIP-712 structured data signing and signature verification using Viem.
 * Adheres strictly to the LUCENTRA EIP-712 domain specification.
 */

import {
  getAddress,
  isAddressEqual,
  recoverTypedDataAddress,
  type TypedDataDomain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LucentraError } from "./errors.js";
import type {
  Address,
  Hex,
  LucentraEip712Domain,
  RegistrationAuthorizationMessage,
  ReleaseManifest,
  ReleaseManifestMessage,
} from "./types.js";

/**
 * Standard protocol EIP-712 domain values
 */
export const LUCENTRA_DOMAIN_NAME = "LUCENTRA" as const;
export const LUCENTRA_DOMAIN_VERSION = "1" as const;

/**
 * Default network parameters (Sepolia testnet)
 */
export const DEFAULT_CHAIN_ID = 11155111;
export const DEFAULT_VERIFYING_CONTRACT: Address =
  "0x1111111111111111111111111111111111111111";

/**
 * EIP-712 Primary type name for release manifests.
 */
export const RELEASE_MANIFEST_PRIMARY_TYPE = "ReleaseManifest" as const;

/**
 * Approved EIP-712 type definition for ReleaseManifest.
 */
export const RELEASE_MANIFEST_EIP712_TYPES = {
  ReleaseManifest: [
    { name: "domain", type: "string" },
    { name: "version", type: "string" },
    { name: "sequence", type: "uint64" },
    { name: "previousManifestHash", type: "bytes32" },
    { name: "manifestHash", type: "bytes32" },
    { name: "timestamp", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

/**
 * EIP-712 Primary type name for registration authorizations (ADR-011).
 */
export const REGISTRATION_AUTHORIZATION_PRIMARY_TYPE =
  "RegistrationAuthorization" as const;

/**
 * Approved EIP-712 type definition for RegistrationAuthorization (ADR-011).
 */
export const REGISTRATION_AUTHORIZATION_EIP712_TYPES = {
  RegistrationAuthorization: [
    { name: "domain", type: "string" },
    { name: "publisher", type: "address" },
    { name: "initialSigningKey", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

/**
 * Constructs the canonical EIP-712 domain separator object.
 */
export function createLucentraDomain(
  chainId: number = DEFAULT_CHAIN_ID,
  verifyingContract: Address = DEFAULT_VERIFYING_CONTRACT
): LucentraEip712Domain {
  return {
    name: LUCENTRA_DOMAIN_NAME,
    version: LUCENTRA_DOMAIN_VERSION,
    chainId,
    verifyingContract: getAddress(verifyingContract),
  };
}

/**
 * Builds the EIP-712 message payload from a validated manifest and its canonical manifestHash.
 */
export function buildReleaseManifestMessage(
  manifest: ReleaseManifest,
  manifestHash: Hex
): ReleaseManifestMessage {
  return {
    domain: manifest.domain,
    version: manifest.version,
    sequence: BigInt(manifest.sequence ?? 1),
    previousManifestHash: (manifest.previousManifestHash ??
      "0x0000000000000000000000000000000000000000000000000000000000000000") as Hex,
    manifestHash,
    timestamp: BigInt(manifest.createdAt),
    expiresAt: BigInt(manifest.expiresAt),
  };
}

export interface SignReleaseOptions {
  readonly manifest: ReleaseManifest;
  readonly manifestHash: Hex;
  readonly privateKey: Hex;
  readonly chainId?: number;
  readonly verifyingContract?: Address;
}

/**
 * Signs a release manifest using a private key (for publisher CLI, test suites, and off-chain daemons).
 */
export async function signReleaseManifestWithAccount(
  options: SignReleaseOptions
): Promise<{ signature: Hex; signer: Address }> {
  try {
    const account = privateKeyToAccount(options.privateKey);
    const domain = createLucentraDomain(
      options.chainId ?? DEFAULT_CHAIN_ID,
      options.verifyingContract ?? DEFAULT_VERIFYING_CONTRACT
    );
    const message = buildReleaseManifestMessage(
      options.manifest,
      options.manifestHash
    );

    const signature = await account.signTypedData({
      domain: domain as unknown as TypedDataDomain,
      types: RELEASE_MANIFEST_EIP712_TYPES,
      primaryType: RELEASE_MANIFEST_PRIMARY_TYPE,
      message,
    });

    return {
      signature,
      signer: account.address,
    };
  } catch (err: unknown) {
    throw new LucentraError(
      "INVALID_EIP712_SIGNATURE",
      `Failed to sign release manifest: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export interface RecoverReleaseSignerParams {
  readonly domain: string;
  readonly version: string;
  readonly sequence?: bigint | number;
  readonly previousManifestHash?: Hex;
  readonly manifestHash: Hex;
  readonly timestamp: bigint | number;
  readonly expiresAt: bigint | number;
  readonly signature: Hex;
  readonly chainId?: number;
  readonly verifyingContract?: Address;
}

/**
 * Cryptographically recovers the Ethereum address that signed an EIP-712 release manifest.
 */
export async function recoverReleaseSigner(
  params: RecoverReleaseSignerParams
): Promise<Address> {
  try {
    const domain = createLucentraDomain(
      params.chainId ?? DEFAULT_CHAIN_ID,
      params.verifyingContract ?? DEFAULT_VERIFYING_CONTRACT
    );

    const message: ReleaseManifestMessage = {
      domain: params.domain,
      version: params.version,
      sequence: BigInt(params.sequence ?? 1),
      previousManifestHash:
        params.previousManifestHash ??
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      manifestHash: params.manifestHash,
      timestamp: BigInt(params.timestamp),
      expiresAt: BigInt(params.expiresAt),
    };

    const recovered = await recoverTypedDataAddress({
      domain: domain as unknown as TypedDataDomain,
      types: RELEASE_MANIFEST_EIP712_TYPES,
      primaryType: RELEASE_MANIFEST_PRIMARY_TYPE,
      message,
      signature: params.signature,
    });

    return getAddress(recovered);
  } catch (err: unknown) {
    throw new LucentraError(
      "INVALID_EIP712_SIGNATURE",
      `Cryptographic signature recovery failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export interface VerifyReleaseSignatureParams extends RecoverReleaseSignerParams {
  readonly expectedSigner: Address;
}

/**
 * Recovers the signer and verifies whether it matches the expected publisher address.
 */
export async function verifyReleaseSignature(
  params: VerifyReleaseSignatureParams
): Promise<{ isValid: boolean; recoveredSigner: Address }> {
  const recoveredSigner = await recoverReleaseSigner(params);
  const isValid = isAddressEqual(recoveredSigner, getAddress(params.expectedSigner));
  return {
    isValid,
    recoveredSigner,
  };
}

export interface SignRegistrationAuthOptions {
  readonly domain: string;
  readonly publisher: Address;
  readonly initialSigningKey: Address;
  readonly nonce: bigint;
  readonly deadline: bigint;
  readonly privateKey: Hex;
  readonly chainId?: number;
  readonly verifyingContract?: Address;
}

/**
 * Signs an EIP-712 RegistrationAuthorization intent (ADR-011) using the publisher's wallet.
 */
export async function signRegistrationAuthorizationWithAccount(
  options: SignRegistrationAuthOptions
): Promise<{ signature: Hex; signer: Address }> {
  try {
    const account = privateKeyToAccount(options.privateKey);
    const domain = createLucentraDomain(
      options.chainId ?? DEFAULT_CHAIN_ID,
      options.verifyingContract ?? DEFAULT_VERIFYING_CONTRACT
    );
    const message: RegistrationAuthorizationMessage = {
      domain: options.domain,
      publisher: getAddress(options.publisher),
      initialSigningKey: getAddress(options.initialSigningKey),
      nonce: options.nonce,
      deadline: options.deadline,
    };

    const signature = await account.signTypedData({
      domain: domain as unknown as TypedDataDomain,
      types: REGISTRATION_AUTHORIZATION_EIP712_TYPES,
      primaryType: REGISTRATION_AUTHORIZATION_PRIMARY_TYPE,
      message,
    });

    return {
      signature,
      signer: account.address,
    };
  } catch (err: unknown) {
    throw new LucentraError(
      "INVALID_EIP712_SIGNATURE",
      `Failed to sign registration authorization: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export interface RecoverRegistrationAuthParams {
  readonly message: RegistrationAuthorizationMessage;
  readonly signature: Hex;
  readonly chainId?: number;
  readonly verifyingContract?: Address;
}

/**
 * Recovers the publisher address that signed a RegistrationAuthorization intent.
 */
export async function recoverRegistrationAuthorizationSigner(
  params: RecoverRegistrationAuthParams
): Promise<Address> {
  try {
    const domain = createLucentraDomain(
      params.chainId ?? DEFAULT_CHAIN_ID,
      params.verifyingContract ?? DEFAULT_VERIFYING_CONTRACT
    );

    const recovered = await recoverTypedDataAddress({
      domain: domain as unknown as TypedDataDomain,
      types: REGISTRATION_AUTHORIZATION_EIP712_TYPES,
      primaryType: REGISTRATION_AUTHORIZATION_PRIMARY_TYPE,
      message: params.message,
      signature: params.signature,
    });

    return getAddress(recovered);
  } catch (err: unknown) {
    throw new LucentraError(
      "INVALID_EIP712_SIGNATURE",
      `Registration authorization recovery failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}


