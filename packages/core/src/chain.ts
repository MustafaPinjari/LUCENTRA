/**
 * @file chain.ts
 * @package @lucentra/core
 * @description On-chain integration client for LUCENTRA EVM contracts and EAS attestations.
 */

import {
  createPublicClient,
  http,
  type PublicClient,
  type Address,
  type Hex,
  decodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toBytes,
  getAddress,
} from "viem";
import type {
  ReleaseManifest,
  ObservedResource,
  VerifyReleaseResult,
} from "./types.js";
import { verifyRelease } from "./verifier.js";
import { LucentraError } from "./errors.js";

export interface LucentraDeploymentConfig {
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly contracts: {
    readonly SchemaRegistry?: { readonly address: Address };
    readonly EAS: { readonly address: Address };
    readonly PublisherRegistry: { readonly address: Address };
    readonly SignatureVerifier: { readonly address: Address };
    readonly ReleaseAttestationVerifier: { readonly address: Address };
  };
  readonly schema: {
    readonly uid: Hex;
    readonly raw: string;
    readonly resolver?: Address;
    readonly revocable?: boolean;
    readonly transactionHash?: Hex;
  };
  readonly roles?: {
    readonly deployer?: Address;
    readonly registrar?: Address;
    readonly publisher?: Address;
    readonly signingKey?: Address;
    readonly relayer?: Address;
    readonly attacker?: Address;
  };
}

export interface OnChainPublisherInfo {
  readonly domain: string;
  readonly domainHash: Hex;
  readonly owner: Address;
  readonly isSuspended: boolean;
  readonly registeredAt: bigint;
}

export interface DecodedReleaseAttestationData {
  readonly manifestHash: Hex;
  readonly domain: string;
  readonly version: string;
  readonly sequence: bigint;
  readonly previousManifestHash: Hex;
  readonly timestamp: bigint;
  readonly expiresAt: bigint;
  readonly signingKey: Address;
  readonly signature: Hex;
}

export interface OnChainAttestationRecord {
  readonly uid: Hex;
  readonly schema: Hex;
  readonly time: bigint;
  readonly expirationTime: bigint;
  readonly revocationTime: bigint;
  readonly recipient: Address;
  readonly attester: Address;
  readonly revocable: boolean;
  readonly data: Hex;
  readonly decoded: DecodedReleaseAttestationData;
}

export interface VerifyOnChainOptions {
  readonly manifest: ReleaseManifest;
  readonly observedResources: readonly ObservedResource[];
  readonly signature: Hex;
  readonly attestationUid?: Hex;
  readonly evaluationTime?: number;
}

// Minimal ABIs for on-chain querying
const PUBLISHER_REGISTRY_ABI = [
  {
    type: "function",
    name: "getDomainOwner",
    inputs: [{ name: "domain", type: "string" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isKeyAuthorized",
    inputs: [
      { name: "domain", type: "string" },
      { name: "signingKey", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isPublisherSuspended",
    inputs: [{ name: "domain", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDomainInfo",
    inputs: [{ name: "domain", type: "string" }],
    outputs: [
      {
        components: [
          { name: "owner", type: "address" },
          { name: "registeredAt", type: "uint64" },
          { name: "isSuspended", type: "bool" },
          { name: "domain", type: "string" },
        ],
        type: "tuple",
      },
    ],
    stateMutability: "view",
  },
] as const;

const EAS_ABI = [
  {
    type: "function",
    name: "getAttestation",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        components: [
          { name: "uid", type: "bytes32" },
          { name: "schema", type: "bytes32" },
          { name: "time", type: "uint64" },
          { name: "expirationTime", type: "uint64" },
          { name: "revocationTime", type: "uint64" },
          { name: "refUID", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "attester", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "data", type: "bytes" },
        ],
        type: "tuple",
      },
    ],
    stateMutability: "view",
  },
] as const;

const RELEASE_VERIFIER_ABI = [
  {
    type: "function",
    name: "latestSequence",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "latestManifestHash",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
] as const;

const RELEASE_DATA_ABI_PARAMS = parseAbiParameters(
  "bytes32 manifestHash, string domain, string version, uint64 sequence, bytes32 previousManifestHash, uint64 timestamp, uint64 expiresAt, address signingKey, bytes signature"
);

/**
 * On-chain interaction client connecting `@lucentra/core` with deployed EVM contracts.
 */
export class LucentraChainClient {
  public readonly client: PublicClient;
  public readonly config: LucentraDeploymentConfig;

  constructor(config: LucentraDeploymentConfig) {
    this.config = config;
    this.client = createPublicClient({
      transport: http(config.rpcUrl),
    });
  }

  /**
   * Queries the authoritative domain registration info from PublisherRegistry.
   */
  public async queryPublisher(domain: string): Promise<OnChainPublisherInfo> {
    const domainHash = keccak256(toBytes(domain));
    const info = await this.client.readContract({
      address: this.config.contracts.PublisherRegistry.address,
      abi: PUBLISHER_REGISTRY_ABI,
      functionName: "getDomainInfo",
      args: [domain],
    });

    return {
      domain,
      domainHash,
      owner: getAddress(info.owner),
      isSuspended: info.isSuspended,
      registeredAt: BigInt(info.registeredAt),
    };
  }

  /**
   * Checks whether a signing key is actively authorized for a publisher domain.
   */
  public async isKeyAuthorized(domain: string, signingKey: Address): Promise<boolean> {
    return this.client.readContract({
      address: this.config.contracts.PublisherRegistry.address,
      abi: PUBLISHER_REGISTRY_ABI,
      functionName: "isKeyAuthorized",
      args: [domain, getAddress(signingKey)],
    });
  }

  /**
   * Retrieves and decodes an on-chain EAS release attestation record.
   */
  public async queryAttestation(attestationUid: Hex): Promise<OnChainAttestationRecord> {
    const attestation = await this.client.readContract({
      address: this.config.contracts.EAS.address,
      abi: EAS_ABI,
      functionName: "getAttestation",
      args: [attestationUid],
    });

    if (attestation.uid === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      throw new LucentraError("INVALID_HASH_FORMAT", `Attestation UID ${attestationUid} not found on EAS`);
    }

    // Decode 9-field attestation payload
    const decoded = decodeAbiParameters(RELEASE_DATA_ABI_PARAMS, attestation.data);

    return {
      uid: attestation.uid,
      schema: attestation.schema,
      time: BigInt(attestation.time),
      expirationTime: BigInt(attestation.expirationTime),
      revocationTime: BigInt(attestation.revocationTime),
      recipient: getAddress(attestation.recipient),
      attester: getAddress(attestation.attester),
      revocable: attestation.revocable,
      data: attestation.data,
      decoded: {
        manifestHash: decoded[0],
        domain: decoded[1],
        version: decoded[2],
        sequence: decoded[3],
        previousManifestHash: decoded[4],
        timestamp: decoded[5],
        expiresAt: decoded[6],
        signingKey: getAddress(decoded[7]),
        signature: decoded[8],
      },
    };
  }

  /**
   * Queries latest attested sequence and manifest hash for a domain.
   */
  public async queryLatestReleaseState(domain: string): Promise<{ sequence: bigint; manifestHash: Hex }> {
    const domainHash = keccak256(toBytes(domain));
    const [sequence, manifestHash] = await Promise.all([
      this.client.readContract({
        address: this.config.contracts.ReleaseAttestationVerifier.address,
        abi: RELEASE_VERIFIER_ABI,
        functionName: "latestSequence",
        args: [domainHash],
      }),
      this.client.readContract({
        address: this.config.contracts.ReleaseAttestationVerifier.address,
        abi: RELEASE_VERIFIER_ABI,
        functionName: "latestManifestHash",
        args: [domainHash],
      }),
    ]);

    return {
      sequence: BigInt(sequence),
      manifestHash,
    };
  }

  /**
   * End-to-end release verification pipeline combining on-chain registry state,
   * EAS attestation validity, and cryptographic resource observations.
   */
  public async verifyReleaseOnChain(options: VerifyOnChainOptions): Promise<VerifyReleaseResult> {
    const pubInfo = await this.queryPublisher(options.manifest.domain);

    let attestationRecord: OnChainAttestationRecord | undefined;
    let isAttestationRevoked = false;
    let authorizedKeys: Address[] = [];

    if (options.attestationUid) {
      try {
        attestationRecord = await this.queryAttestation(options.attestationUid);
        const evalTime = BigInt(options.evaluationTime ?? Math.floor(Date.now() / 1000));
        isAttestationRevoked = attestationRecord.revocationTime !== 0n;
        const isExpired =
          attestationRecord.expirationTime !== 0n && evalTime > attestationRecord.expirationTime;
        const schemaMatches =
          attestationRecord.schema.toLowerCase() === this.config.schema.uid.toLowerCase();

        if (schemaMatches && !isExpired && !isAttestationRevoked) {
          const isAuthorized = await this.isKeyAuthorized(
            options.manifest.domain,
            attestationRecord.decoded.signingKey
          );
          if (isAuthorized) {
            authorizedKeys.push(attestationRecord.decoded.signingKey);
          }
        }
      } catch {
        isAttestationRevoked = false;
      }
    }

    // Call pure core verification engine
    return verifyRelease({
      manifest: options.manifest,
      observedResources: options.observedResources,
      signature: options.signature,
      attestationUid: options.attestationUid,
      expectedPublisher: pubInfo.owner,
      authorizedSigningKeys: authorizedKeys,
      isRevoked: pubInfo.isSuspended || isAttestationRevoked,
      evaluationTime: options.evaluationTime,
      chainId: this.config.chainId,
      verifyingContract: this.config.contracts.SignatureVerifier.address,
    });
  }
}
