/**
 * @file cli.ts
 * @package @lucentra/core
 * @description Internal CLI interface for subprocess invocation by Django backend.
 * Uses structured JSON I/O, strict parameter validation, and explicit error codes.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  isAddressEqual,
  parseAbi,
  parseEventLogs,
  defineChain,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  LucentraChainClient,
  type LucentraDeploymentConfig,
} from "./chain.js";
import {
  recoverRegistrationAuthorizationSigner,
  signRegistrationAuthorizationWithAccount,
  signReleaseManifestWithAccount,
} from "./signature.js";
import { canonicalizeManifest } from "./canonical.js";
import { hashManifest } from "./hash.js";
import { normalizeDomain } from "./validation.js";

function makeAnvilChain(rpcUrl: string) {
  return defineChain({
    id: 31337,
    name: "Anvil Local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  });
}

const PUBLISHER_REGISTRY_ABI = parseAbi([
  "function registerPublisherDomainWithAuth(string domain, address publisher, address initialSigningKey, uint64 deadline, bytes signature) external",
  "function isKeyAuthorized(string domain, address signingKey) external view returns (bool)",
  "function getDomainOwner(string domain) external view returns (address)",
  "function isPublisherSuspended(string domain) external view returns (bool)",
  "function getDomainInfo(string domain) external view returns ((address owner, uint64 registeredAt, bool isSuspended, string domain))",
  "function nonces(address publisher) external view returns (uint256)",
  "error InvalidSignature()",
  "error DomainAlreadyRegistered()",
  "error SignatureExpired()",
  "error PublisherIsSuspended()",
]);

const RELEASE_VERIFIER_ABI = parseAbi([
  "struct ReleaseAttestationData { bytes32 manifestHash; string domain; string version; uint64 sequence; bytes32 previousManifestHash; uint64 timestamp; uint64 expiresAt; address signingKey; bytes signature; }",
  "function attestRelease(ReleaseAttestationData calldata data) external payable returns (bytes32)",
  "function revokeRelease(bytes32 attestationUid) external",
  "function verifyAttestation(bytes32 attestationUid, uint64 evaluationTime) external view returns ((bool isValid, bytes32 manifestHash, string domain, string version, uint64 sequence, address signingKey, address publisher))",
  "function latestSequence(bytes32 domainHash) external view returns (uint64)",
  "function latestManifestHash(bytes32 domainHash) external view returns (bytes32)",
  "event ReleaseAttested(bytes32 indexed uid, bytes32 indexed manifestHash, string domain, string version, uint64 sequence)",
  "error BrokenContinuity()",
  "error SequenceRollback()",
  "error AttestationExpired()",
  "error UnauthorizedSigningKey()",
  "error InvalidReleaseSignature()",
]);

const SCHEMA_REGISTRY_ABI = parseAbi([
  "function getSchema(bytes32 uid) external view returns ((bytes32 uid, address resolver, bool revocable, string schema))",
]);

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "-h" || command === "--help") {
    console.log(
      JSON.stringify({
        usage: "node cli.js <command> <json-input>",
        commands: [
          "verify-registration-auth",
          "query-publisher",
          "is-key-authorized",
          "get-nonce",
          "register-domain",
          "query-attestation",
          "query-latest-release",
          "attest-release",
          "check-readiness",
          "verify-release",
        ],
      })
    );
    process.exit(0);
  }

  let rawInput = args[1];
  if (!rawInput) {
    if (!process.stdin.isTTY) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const stdinStr = Buffer.concat(chunks).toString("utf8").trim();
      if (stdinStr) {
        rawInput = stdinStr;
      }
    }
  }
  if (!rawInput) {
    rawInput = "{}";
  }
  let input: any;
  try {
    input = JSON.parse(rawInput);
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        success: false,
        error: `Invalid JSON input: ${err instanceof Error ? err.message : String(err)}`,
      })
    );
    process.exit(1);
  }

  try {
    switch (command) {
      case "verify-registration-auth": {
        const canonicalDomain = normalizeDomain(input.domain);
        const publisher = getAddress(input.publisher);
        const initialSigningKey = getAddress(input.initialSigningKey);
        const nonce = BigInt(input.nonce);
        const deadline = BigInt(input.deadline);
        const signature = input.signature as Hex;
        const chainId = Number(input.chainId ?? 31337);
        const verifyingContract = getAddress(input.verifyingContract);

        const recovered = await recoverRegistrationAuthorizationSigner({
          message: {
            domain: canonicalDomain,
            publisher,
            initialSigningKey,
            nonce,
            deadline,
          },
          signature,
          chainId,
          verifyingContract,
        });

        const isValid = isAddressEqual(recovered, publisher);
        console.log(
          JSON.stringify({
            success: true,
            isValid,
            recoveredSigner: recovered,
          })
        );
        break;
      }

      case "sign-registration-auth": {
        const canonicalDomain = normalizeDomain(input.domain);
        const publisher = getAddress(input.publisher);
        const initialSigningKey = getAddress(input.initialSigningKey);
        const nonce = BigInt(input.nonce);
        const deadline = BigInt(input.deadline);
        const privateKey = input.privateKey as Hex;
        const chainId = Number(input.chainId ?? 31337);
        const verifyingContract = getAddress(input.verifyingContract);

        const res = await signRegistrationAuthorizationWithAccount({
          domain: canonicalDomain,
          publisher,
          initialSigningKey,
          nonce,
          deadline,
          privateKey,
          chainId,
          verifyingContract,
        });

        console.log(
          JSON.stringify({
            success: true,
            signature: res.signature,
            signer: res.signer,
          })
        );
        break;
      }

      case "sign-release": {
        const manifest = input.manifest;
        const privateKey = input.privateKey as Hex;
        const chainId = Number(input.chainId ?? 31337);
        const verifyingContract = getAddress(input.verifyingContract);

        const canonical = canonicalizeManifest(manifest);
        const manifestHash = hashManifest(canonical);

        const res = await signReleaseManifestWithAccount({
          manifest,
          manifestHash,
          privateKey,
          chainId,
          verifyingContract,
        });

        console.log(
          JSON.stringify({
            success: true,
            signature: res.signature,
            manifestHash,
            signer: res.signer,
          })
        );
        break;
      }

      case "get-nonce": {
        const publisher = getAddress(input.publisher);
        const rpcUrl = input.rpcUrl ?? "http://127.0.0.1:8545";
        const pubRegAddr = getAddress(
          input.publisherRegistryAddress || input.publisherRegistry
        );

        const client = createPublicClient({
          chain: makeAnvilChain(rpcUrl),
          transport: http(rpcUrl),
        });

        const nonce = (await client.readContract({
          address: pubRegAddr,
          abi: PUBLISHER_REGISTRY_ABI,
          functionName: "nonces",
          args: [publisher],
        })) as bigint;

        console.log(
          JSON.stringify({
            success: true,
            nonce: nonce.toString(),
          })
        );
        break;
      }

      case "query-publisher": {
        const canonicalDomain = normalizeDomain(input.domain);
        const rpcUrl = input.rpcUrl ?? "http://127.0.0.1:8545";
        const pubRegAddr = getAddress(
          input.publisherRegistryAddress || input.publisherRegistry
        );

        const client = createPublicClient({
          chain: makeAnvilChain(rpcUrl),
          transport: http(rpcUrl),
        });

        const info = (await client.readContract({
          address: pubRegAddr,
          abi: PUBLISHER_REGISTRY_ABI,
          functionName: "getDomainInfo",
          args: [canonicalDomain],
        })) as {
          owner: Address;
          registeredAt: bigint | number;
          isSuspended: boolean;
          domain: string;
        };

        const isRegistered =
          info.owner !== "0x0000000000000000000000000000000000000000";

        console.log(
          JSON.stringify({
            success: true,
            isRegistered,
            publisher: {
              domain: info.domain || canonicalDomain,
              owner: getAddress(info.owner),
              isSuspended: info.isSuspended,
              registeredAt: Number(info.registeredAt),
            },
          })
        );
        break;
      }

      case "is-key-authorized": {
        const canonicalDomain = normalizeDomain(input.domain);
        const signingKey = getAddress(input.signingKey);
        const rpcUrl = input.rpcUrl ?? "http://127.0.0.1:8545";
        const pubRegAddr = getAddress(
          input.publisherRegistryAddress || input.publisherRegistry
        );

        const client = createPublicClient({
          chain: makeAnvilChain(rpcUrl),
          transport: http(rpcUrl),
        });

        const isAuthorized = (await client.readContract({
          address: pubRegAddr,
          abi: PUBLISHER_REGISTRY_ABI,
          functionName: "isKeyAuthorized",
          args: [canonicalDomain, signingKey],
        })) as boolean;

        console.log(
          JSON.stringify({
            success: true,
            isAuthorized,
          })
        );
        break;
      }

      case "register-domain": {
        const canonicalDomain = normalizeDomain(input.domain);
        const publisher = getAddress(input.publisher);
        const initialSigningKey = getAddress(input.initialSigningKey);
        const deadline = BigInt(input.deadline);
        const signature = input.signature as Hex;
        const rpcUrl = input.rpcUrl ?? "http://127.0.0.1:8545";
        const pubRegAddr = getAddress(
          input.publisherRegistryAddress || input.publisherRegistry
        );
        const registrarKey = input.registrarPrivateKey as Hex;

        const anvilChain = makeAnvilChain(rpcUrl);
        const publicClient = createPublicClient({
          chain: anvilChain,
          transport: http(rpcUrl),
        });

        const registrarAccount = privateKeyToAccount(registrarKey);
        const walletClient = createWalletClient({
          chain: anvilChain,
          account: registrarAccount,
          transport: http(rpcUrl),
        });

        const txHash = await walletClient.writeContract({
          address: pubRegAddr,
          abi: PUBLISHER_REGISTRY_ABI,
          functionName: "registerPublisherDomainWithAuth",
          args: [
            canonicalDomain,
            publisher,
            initialSigningKey,
            deadline,
            signature,
          ],
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (receipt.status !== "success") {
          throw new Error(
            `Registration transaction failed with status: ${receipt.status}`
          );
        }

        const info = (await publicClient.readContract({
          address: pubRegAddr,
          abi: PUBLISHER_REGISTRY_ABI,
          functionName: "getDomainInfo",
          args: [canonicalDomain],
        })) as {
          owner: Address;
          registeredAt: bigint | number;
          isSuspended: boolean;
          domain: string;
        };

        console.log(
          JSON.stringify({
            success: true,
            transactionHash: txHash,
            blockNumber: Number(receipt.blockNumber),
            domain: canonicalDomain,
            owner: getAddress(info.owner),
            registeredAt: Number(info.registeredAt),
          })
        );
        break;
      }

      case "query-attestation": {
        const uid = input.attestationUid as Hex;
        const rpcUrl = input.rpcUrl ?? "http://127.0.0.1:8545";
        const deploymentConfig: LucentraDeploymentConfig = input.config ?? {
          rpcUrl,
          chainId: 31337,
          schemaUid: input.schemaUid ?? "0xac04bb1a769e2c3647d6b15fbb4459e8d708947771b94466bf8f648b3c8c3b50",
          contracts: {
            SchemaRegistry: input.schemaRegistry ?? "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            EAS: input.eas ?? "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
            PublisherRegistry: input.publisherRegistry ?? "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
            SignatureVerifier: input.signatureVerifier ?? "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
            ReleaseAttestationVerifier: input.releaseVerifier ?? "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
          },
        };

        const chainClient = new LucentraChainClient({
          ...deploymentConfig,
          rpcUrl,
        });

        const record = await chainClient.queryAttestation(uid);
        const nowSec = BigInt(Math.floor(Date.now() / 1000));
        const isValid =
          record.revocationTime === 0n &&
          (record.expirationTime === 0n || record.expirationTime > nowSec);

        console.log(
          JSON.stringify(
            {
              success: true,
              record,
              isValid,
              attestation: {
                uid: record.uid,
                schema: record.schema,
                time: record.time,
                expirationTime: record.expirationTime,
                revocationTime: record.revocationTime,
                attester: record.attester,
                recipient: record.recipient,
                revocable: record.revocable,
              },
              publisher: record.attester,
            },
            (_, v) => (typeof v === "bigint" ? v.toString() : v)
          )
        );
        break;
      }

      case "query-latest-release": {
        const canonicalDomain = normalizeDomain(input.domain);
        const rpcUrl = input.rpcUrl ?? "http://127.0.0.1:8545";
        const deploymentConfig: LucentraDeploymentConfig = input.config ?? {
          rpcUrl,
          chainId: 31337,
          schemaUid: input.schemaUid ?? "0xac04bb1a769e2c3647d6b15fbb4459e8d708947771b94466bf8f648b3c8c3b50",
          contracts: {
            ReleaseAttestationVerifier: input.releaseVerifier ?? "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
          },
        };

        const chainClient = new LucentraChainClient({
          ...deploymentConfig,
          rpcUrl,
        });

        const res = await chainClient.queryLatestReleaseState(canonicalDomain);
        console.log(
          JSON.stringify({
            success: true,
            sequence: res.sequence.toString(),
            manifestHash: res.manifestHash,
          })
        );
        break;
      }

      case "attest-release": {
        const rpcUrl = input.rpcUrl ?? "http://127.0.0.1:8545";
        const relVerifierAddr = getAddress(
          input.releaseVerifierAddress || input.releaseVerifier
        );
        const relayerKey = (input.relayerPrivateKey || input.registrarPrivateKey) as Hex;
        const relData = input.releaseData || input.data;

        const anvilChain = makeAnvilChain(rpcUrl);
        const publicClient = createPublicClient({
          chain: anvilChain,
          transport: http(rpcUrl),
        });

        const relayerAccount = privateKeyToAccount(relayerKey);
        const walletClient = createWalletClient({
          chain: anvilChain,
          account: relayerAccount,
          transport: http(rpcUrl),
        });

        const txHash = await walletClient.writeContract({
          address: relVerifierAddr,
          abi: RELEASE_VERIFIER_ABI,
          functionName: "attestRelease",
          args: [
            {
              manifestHash: relData.manifestHash as Hex,
              domain: normalizeDomain(relData.domain),
              version: relData.version,
              sequence: BigInt(relData.sequence),
              previousManifestHash: (relData.previousManifestHash ??
                "0x0000000000000000000000000000000000000000000000000000000000000000") as Hex,
              timestamp: BigInt(relData.timestamp),
              expiresAt: BigInt(relData.expiresAt),
              signingKey: getAddress(relData.signingKey),
              signature: relData.signature as Hex,
            },
          ],
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        const releaseLogs = parseEventLogs({
          abi: RELEASE_VERIFIER_ABI,
          eventName: "ReleaseAttested",
          logs: receipt.logs,
        });

        const log0 = releaseLogs[0] as any;
        const uid = log0 ? (log0.args.uid as Hex) : null;

        console.log(
          JSON.stringify({
            success: true,
            transactionHash: txHash,
            blockNumber: Number(receipt.blockNumber),
            attestationUid: uid,
          })
        );
        break;
      }

      case "check-readiness": {
        const rpcUrl = input.rpcUrl ?? "http://127.0.0.1:8545";
        const expectedChainId = Number(input.expectedChainId ?? 31337);
        const contracts = input.contracts ?? {};
        const schemaUid = input.schemaUid as Hex;

        const anvilChain = makeAnvilChain(rpcUrl);
        const client = createPublicClient({
          chain: anvilChain,
          transport: http(rpcUrl),
        });

        let rpcConnected = false;
        let chainId = 0;
        let contractsReady = false;
        let schemaReady = false;

        try {
          chainId = await client.getChainId();
          rpcConnected = chainId === expectedChainId;
        } catch {
          rpcConnected = false;
        }

        if (rpcConnected) {
          try {
            const checkBytecodes = await Promise.all([
              contracts.SchemaRegistry
                ? client.getBytecode({
                    address: getAddress(contracts.SchemaRegistry),
                  })
                : null,
              contracts.EAS
                ? client.getBytecode({ address: getAddress(contracts.EAS) })
                : null,
              contracts.PublisherRegistry
                ? client.getBytecode({
                    address: getAddress(contracts.PublisherRegistry),
                  })
                : null,
              contracts.SignatureVerifier
                ? client.getBytecode({
                    address: getAddress(contracts.SignatureVerifier),
                  })
                : null,
              contracts.ReleaseAttestationVerifier
                ? client.getBytecode({
                    address: getAddress(contracts.ReleaseAttestationVerifier),
                  })
                : null,
            ]);

            contractsReady = checkBytecodes.every(
              (bc) => bc && bc !== "0x" && bc.length > 2
            );
          } catch {
            contractsReady = false;
          }

          if (contracts.SchemaRegistry && schemaUid) {
            try {
              const schemaRecord = (await client.readContract({
                address: getAddress(contracts.SchemaRegistry),
                abi: SCHEMA_REGISTRY_ABI,
                functionName: "getSchema",
                args: [schemaUid],
              })) as { uid: Hex; resolver: Address; revocable: boolean; schema: string };

              schemaReady =
                schemaRecord.uid.toLowerCase() === schemaUid.toLowerCase();
            } catch {
              schemaReady = false;
            }
          }
        }

        console.log(
          JSON.stringify({
            success: true,
            rpcConnected,
            chainId,
            contractsReady,
            schemaReady,
          })
        );
        break;
      }

      case "verify-release": {
        const deploymentConfig: LucentraDeploymentConfig = input.config;
        const chainClient = new LucentraChainClient(deploymentConfig);

        let observedResources = input.observedResources;
        if (observedResources && !Array.isArray(observedResources)) {
          observedResources = Object.entries(observedResources).map(
            ([path, val]) => {
              if (typeof val === "string" && val.startsWith("sha256:")) {
                return { path, hash: val };
              }
              return { path, bytes: val as string };
            }
          );
        } else if (!observedResources) {
          observedResources = [];
        }

        const res = await chainClient.verifyReleaseOnChain({
          manifest: input.manifest,
          observedResources,
          signature: input.signature,
          attestationUid: input.attestationUid,
          evaluationTime: input.evaluationTime,
        });

        console.log(JSON.stringify({ success: true, result: res }));
        break;
      }

      default:
        console.error(
          JSON.stringify({
            success: false,
            error: `Unknown command: ${command}`,
          })
        );
        process.exit(1);
    }
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    process.exit(1);
  }
}

main();
