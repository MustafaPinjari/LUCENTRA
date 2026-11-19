/**
 * @file lib/contracts.ts
 * @package @lucentra/dashboard
 * @description Contract ABIs, deployment configurations, and EIP-712 helpers.
 */

import {
  createLucentraDomain,
  REGISTRATION_AUTHORIZATION_EIP712_TYPES,
  REGISTRATION_AUTHORIZATION_PRIMARY_TYPE,
  RELEASE_MANIFEST_EIP712_TYPES,
  RELEASE_MANIFEST_PRIMARY_TYPE,
  buildReleaseManifestMessage,
  type LucentraEip712Domain,
  type ReleaseManifest,
  type Hex,
  type Address,
} from "@lucentra/core";

// Contract Addresses for Local Anvil (Chain ID: 31337)
export const DEPLOYED_CONTRACTS = {
  chainId: 31337,
  PublisherRegistry: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as Address,
  SignatureVerifier: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" as Address,
  ReleaseAttestationVerifier: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707" as Address,
  EAS: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as Address,
  SchemaRegistry: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address,
  easSchemaUid: "0xac04bb1a769e2c3647d6b15fbb4459e8d708947771b94466bf8f648b3c8c3b50" as Hex,
};

// PublisherRegistry ABI for client-side interactions
export const PUBLISHER_REGISTRY_ABI = [
  {
    name: "authorizeKey",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "domain", type: "string" },
      { name: "signingKey", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "revokeKey",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "domain", type: "string" },
      { name: "key", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "rotateKey",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "domain", type: "string" },
      { name: "oldKey", type: "address" },
      { name: "newKey", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "getPublisherInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "domain", type: "string" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "registeredAt", type: "uint64" },
      { name: "isSuspended", type: "bool" },
    ],
  },
  {
    name: "isKeyAuthorized",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "domain", type: "string" },
      { name: "key", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "nonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "publisher", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export {
  createLucentraDomain,
  REGISTRATION_AUTHORIZATION_EIP712_TYPES,
  REGISTRATION_AUTHORIZATION_PRIMARY_TYPE,
  RELEASE_MANIFEST_EIP712_TYPES,
  RELEASE_MANIFEST_PRIMARY_TYPE,
  buildReleaseManifestMessage,
};

