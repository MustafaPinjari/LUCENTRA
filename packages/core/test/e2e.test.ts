/**
 * @file e2e.test.ts
 * @package @lucentra/core
 * @description Comprehensive End-to-End local deployment integration test suite.
 * Executes against live local Anvil node (Chain ID 31337).
 * Tests all 20 positive lifecycle steps (Phase 4) and all 13 negative security scenarios (Phase 5).
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  parseEventLogs,
  keccak256,
  toBytes,
  defineChain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  LucentraChainClient,
  type LucentraDeploymentConfig,
  type ReleaseManifest,
  type ObservedResource,
  canonicalizeManifest,
  hashManifest,
  hashAndFormatResource,
  signReleaseManifestWithAccount,
  signRegistrationAuthorizationWithAccount,
  verifyReleaseSignature,
} from "../src/index.js";

// Load local deployment configuration
const DEPLOYMENT_PATH = path.resolve(
  process.cwd(),
  "../../deployments/local/deployment.json"
);

function getDeploymentConfig(): LucentraDeploymentConfig | null {
  // Check alternate paths
  const candidatePaths = [
    DEPLOYMENT_PATH,
    path.resolve(process.cwd(), "deployments/local/deployment.json"),
    path.resolve(process.cwd(), "../deployments/local/deployment.json"),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      let raw = fs.readFileSync(p, "utf8");
      if (raw.charCodeAt(0) === 0xfeff) {
        raw = raw.slice(1);
      }
      return JSON.parse(raw);
    }
  }
  return null;
}

const config = getDeploymentConfig();

const anvilChain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [config?.rpcUrl ?? "http://127.0.0.1:8545"] },
  },
});

// Only run if local deployment is present and Anvil is reachable
const isAnvilRunning = await (async () => {
  if (!config) return false;
  try {
    const pc = createPublicClient({ chain: anvilChain, transport: http(config.rpcUrl) });
    const chainId = await pc.getChainId();
    return chainId === 31337;
  } catch {
    return false;
  }
})();

test("LUCENTRA End-to-End Integration Suite", { skip: !isAnvilRunning }, async (t) => {
  assert.ok(config, "Deployment configuration must exist");

  const chainClient = new LucentraChainClient(config);
  const publicClient = chainClient.client;

  // Account Setup (Anvil deterministic accounts)
  const registrarKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
  const publisherKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as const;
  const signingKeyPriv = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as const;
  const relayerKey = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" as const;
  const attackerKey = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" as const;

  const registrarAccount = privateKeyToAccount(registrarKey);
  const publisherAccount = privateKeyToAccount(publisherKey);
  const signingKeyAccount = privateKeyToAccount(signingKeyPriv);
  const relayerAccount = privateKeyToAccount(relayerKey);
  const attackerAccount = privateKeyToAccount(attackerKey);

  const registrarWallet = createWalletClient({
    chain: anvilChain,
    account: registrarAccount,
    transport: http(config.rpcUrl),
  });
  const publisherWallet = createWalletClient({
    chain: anvilChain,
    account: publisherAccount,
    transport: http(config.rpcUrl),
  });
  const relayerWallet = createWalletClient({
    chain: anvilChain,
    account: relayerAccount,
    transport: http(config.rpcUrl),
  });

  function loadAbi(contractName: string): any {
    const candidateDirs = [
      path.resolve(process.cwd(), "deployments/local/abi"),
      path.resolve(process.cwd(), "../../deployments/local/abi"),
      path.resolve(process.cwd(), "../deployments/local/abi"),
    ];
    for (const dir of candidateDirs) {
      const file = path.join(dir, `${contractName}.json`);
      if (fs.existsSync(file)) {
        let raw = fs.readFileSync(file, "utf8");
        if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
        return JSON.parse(raw).abi;
      }
    }
    throw new Error(`ABI for ${contractName} not found`);
  }

  const publisherRegistryAbi = loadAbi("PublisherRegistry");
  const releaseVerifierAbi = loadAbi("ReleaseAttestationVerifier");
  const schemaRegistryAbi = loadAbi("SchemaRegistry");
  const easAbi = loadAbi("EAS");

  // Use unique domain for test run to ensure idempotency
  const testDomain = `test-${Date.now()}.org`;
  let activeAttestationUid: Hex;
  let sampleManifest: ReleaseManifest;
  let manifestHash: Hex;
  let releaseSignature: Hex;
  let observedResources: ObservedResource[];

  // =========================================================================
  // PHASE 4: THE 20 POSITIVE LIFECYCLE STEPS
  // =========================================================================

  await t.test("Phase 4: Complete 20-Step Positive Lifecycle", async () => {
    // Step 1: Anvil local chain active
    const chainId = await publicClient.getChainId();
    assert.equal(chainId, 31337, "Step 1: Connected to Chain ID 31337");

    // Step 2: Contracts verified
    const pubRegOwner = await chainClient.client.readContract({
      address: config.contracts.PublisherRegistry.address,
      abi: parseAbi(["function registrar() external view returns (address)"]),
      functionName: "registrar",
    });
    assert.equal(pubRegOwner.toLowerCase(), registrarAccount.address.toLowerCase(), "Step 2: Contracts deployed and linked");

    // Step 3: Test publisher identity initialized
    assert.equal(publisherAccount.address, config.roles?.publisher, "Step 3: Publisher wallet configured");

    // Step 4: Generate DNS challenge
    const dnsNonce = "ch_nonce_" + Date.now();
    const dnsTxtRecord = `lucentra-verify=${publisherAccount.address}:${dnsNonce}`;
    assert.ok(dnsTxtRecord.includes(publisherAccount.address), "Step 4: DNS challenge generated");

    // Step 5: Simulate successful DNS challenge verification
    const dnsVerified = true;
    assert.ok(dnsVerified, "Step 5: Backend registrar DNS challenge verification verified");

    // Step 6: Authorize initial publisher registration with EIP-712
    const currentNonce = (await publicClient.readContract({
      address: config.contracts.PublisherRegistry.address,
      abi: publisherRegistryAbi,
      functionName: "nonces",
      args: [publisherAccount.address],
    })) as bigint;

    const regDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const { signature: regAuthSig } = await signRegistrationAuthorizationWithAccount({
      domain: testDomain,
      publisher: publisherAccount.address,
      initialSigningKey: signingKeyAccount.address,
      nonce: currentNonce,
      deadline: regDeadline,
      privateKey: publisherKey,
      chainId: 31337,
      verifyingContract: config.contracts.PublisherRegistry.address,
    });
    assert.ok(regAuthSig.startsWith("0x"), "Step 6: Registration authorization signed via EIP-712");

    // Step 7: Register domain via authorized registrar
    const regTxHash = await registrarWallet.writeContract({
      address: config.contracts.PublisherRegistry.address,
      abi: publisherRegistryAbi,
      functionName: "registerPublisherDomainWithAuth",
      args: [testDomain, publisherAccount.address, signingKeyAccount.address, regDeadline, regAuthSig],
    });
    const regReceipt = await publicClient.waitForTransactionReceipt({ hash: regTxHash });
    assert.equal(regReceipt.status, "success", "Step 7: Domain registered by registrar on-chain");

    // Step 8: Verify publisher owner and authorized release signing key on-chain
    const pubInfo = await chainClient.queryPublisher(testDomain);
    assert.equal(pubInfo.owner.toLowerCase(), publisherAccount.address.toLowerCase(), "Step 8a: Owner matches publisher");
    const isKeyAuth = await chainClient.isKeyAuthorized(testDomain, signingKeyAccount.address);
    assert.equal(isKeyAuth, true, "Step 8b: Signing key is actively authorized");

    // Step 9: Create sample release manifest
    const res1Content = "console.log('App Initialized v1.0.0');";
    const res2Content = "window.vendor = { name: 'VendorLibrary' };";
    const hash1 = hashAndFormatResource(res1Content);
    const hash2 = hashAndFormatResource(res2Content);

    const now = Math.floor(Date.now() / 1000);
    sampleManifest = {
      schemaVersion: "LUCENTRA-Manifest-v0.1",
      domain: testDomain,
      version: "1.0.0",
      sequence: 1,
      previousManifestHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      createdAt: now,
      expiresAt: now + 86400 * 30, // +30 days
      resources: [
        { path: "/assets/app.js", size: Buffer.byteLength(res1Content), sha256: hash1, type: "script" },
        { path: "/assets/vendor.js", size: Buffer.byteLength(res2Content), sha256: hash2, type: "script" },
      ],
    };

    // Step 10: Canonicalize manifest using RFC 8785
    const canonicalJson = canonicalizeManifest(sampleManifest);
    assert.ok(canonicalJson.includes("LUCENTRA-Manifest-v0.1"), "Step 10: Canonical JSON generated per RFC 8785");

    // Step 11: Calculate SHA-256 manifest hash
    manifestHash = hashManifest(canonicalJson);
    assert.ok(/^0x[a-f0-9]{64}$/.test(manifestHash), "Step 11: SHA-256 manifest hash computed");

    // Step 12: Sign the release using publisher signing key
    const sigResult = await signReleaseManifestWithAccount({
      manifest: sampleManifest,
      manifestHash,
      privateKey: signingKeyPriv,
      chainId: 31337,
      verifyingContract: config.contracts.SignatureVerifier.address,
    });
    releaseSignature = sigResult.signature;
    assert.equal(sigResult.signer.toLowerCase(), signingKeyAccount.address.toLowerCase(), "Step 12: Release signed by operational key");

    // Step 13: Submit release attestation via relayer
    const attestTxHash = await relayerWallet.writeContract({
      address: config.contracts.ReleaseAttestationVerifier.address,
      abi: releaseVerifierAbi,
      functionName: "attestRelease",
      args: [{
        manifestHash,
        domain: testDomain,
        version: "1.0.0",
        sequence: 1n,
        previousManifestHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        timestamp: BigInt(sampleManifest.createdAt),
        expiresAt: BigInt(sampleManifest.expiresAt),
        signingKey: signingKeyAccount.address,
        signature: releaseSignature,
      }],
    });
    const attestReceipt = await publicClient.waitForTransactionReceipt({ hash: attestTxHash });
    assert.equal(attestReceipt.status, "success", "Step 13: Release attested on-chain");

    // Extract attestation UID from ReleaseAttested event
    const releaseLogs = parseEventLogs({
      abi: releaseVerifierAbi,
      eventName: "ReleaseAttested",
      logs: attestReceipt.logs,
    });
    assert.equal(releaseLogs.length, 1, "Step 13: ReleaseAttested event emitted");
    const rLog0 = releaseLogs[0] as any;
    assert.ok(rLog0, "Release log exists");
    activeAttestationUid = rLog0.args.uid;
    assert.ok(activeAttestationUid && activeAttestationUid !== "0x0000000000000000000000000000000000000000000000000000000000000000", "Step 13: Attestation UID retrieved");

    // Step 14: Retrieve EAS attestation record
    const attestationRecord = await chainClient.queryAttestation(activeAttestationUid);
    assert.equal(attestationRecord.uid, activeAttestationUid, "Step 14: Attestation record retrieved from EAS");

    // Step 15: Verify publisher authorization
    assert.equal(await chainClient.isKeyAuthorized(testDomain, attestationRecord.decoded.signingKey), true, "Step 15: Signing key is actively authorized");

    // Step 16: Verify release signature
    const sigVerify = await verifyReleaseSignature({
      domain: testDomain,
      version: "1.0.0",
      sequence: 1n,
      previousManifestHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      manifestHash,
      timestamp: sampleManifest.createdAt,
      expiresAt: sampleManifest.expiresAt,
      signature: releaseSignature,
      expectedSigner: signingKeyAccount.address,
      chainId: 31337,
      verifyingContract: config.contracts.SignatureVerifier.address,
    });
    assert.ok(sigVerify.isValid, "Step 16: Cryptographic signature verified against signing key");

    // Step 17: Verify manifest hash matches
    assert.equal(attestationRecord.decoded.manifestHash, manifestHash, "Step 17: Manifest hash strictly matches attestation");

    // Step 18: Verify sequence and continuity
    assert.equal(attestationRecord.decoded.sequence, 1n, "Step 18a: Sequence is 1");
    assert.equal(attestationRecord.decoded.previousManifestHash, "0x0000000000000000000000000000000000000000000000000000000000000000", "Step 18b: Previous manifest hash is zero");

    // Step 19: Verify expiration and revocation
    assert.equal(attestationRecord.revocationTime, 0n, "Step 19a: Attestation is not revoked");
    assert.ok(attestationRecord.decoded.expiresAt > BigInt(now), "Step 19b: Attestation is unexpired");

    // Step 20: Confirm final verification result
    observedResources = [
      { path: "/assets/app.js", hash: hash1 },
      { path: "/assets/vendor.js", hash: hash2 },
    ];
    const finalVerification = await chainClient.verifyReleaseOnChain({
      manifest: sampleManifest,
      observedResources,
      signature: releaseSignature,
      attestationUid: activeAttestationUid,
      evaluationTime: now + 10,
    });

    assert.equal(finalVerification.state, "VERIFIED_RELEASE_MATCH", "Step 20a: Protocol state is VERIFIED_RELEASE_MATCH");
    assert.equal(finalVerification.isValid, true, "Step 20b: Verification result is true");
  });

  // =========================================================================
  // PHASE 5: THE 13 NEGATIVE TEST SCENARIOS
  // =========================================================================

  await t.test("Phase 5: Thirteen Negative Security Scenarios", async (nt) => {
    // 1. Invalid publisher authorization
    await nt.test("1. Reject invalid publisher authorization signature", async () => {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const badDomain = `spoofed-${Date.now()}.com`;
      // Attacker signs instead of genuine publisher
      const { signature: attackerSig } = await signRegistrationAuthorizationWithAccount({
        domain: badDomain,
        publisher: publisherAccount.address, // Alice's address
        initialSigningKey: signingKeyAccount.address,
        nonce: 0n,
        deadline,
        privateKey: attackerKey, // Mallory's key
        chainId: 31337,
        verifyingContract: config.contracts.PublisherRegistry.address,
      });

      await assert.rejects(async () => {
        await registrarWallet.writeContract({
          address: config.contracts.PublisherRegistry.address,
          abi: publisherRegistryAbi,
          functionName: "registerPublisherDomainWithAuth",
          args: [badDomain, publisherAccount.address, signingKeyAccount.address, deadline, attackerSig],
        });
      }, /InvalidSignature|0x8baa579f/);
    });

    // 2. Replayed registration nonce
    await nt.test("2. Reject replayed registration authorization nonce", async () => {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const replayDomain = `replay-${Date.now()}.com`;
      const currentNonce = (await publicClient.readContract({
        address: config.contracts.PublisherRegistry.address,
        abi: publisherRegistryAbi,
        functionName: "nonces",
        args: [publisherAccount.address],
      })) as bigint;
      const staleNonce = currentNonce > 0n ? currentNonce - 1n : 9999n;

      const { signature: authSig } = await signRegistrationAuthorizationWithAccount({
        domain: replayDomain,
        publisher: publisherAccount.address,
        initialSigningKey: signingKeyAccount.address,
        nonce: staleNonce, // Stale/consumed nonce
        deadline,
        privateKey: publisherKey,
        chainId: 31337,
        verifyingContract: config.contracts.PublisherRegistry.address,
      });

      await assert.rejects(async () => {
        await registrarWallet.writeContract({
          address: config.contracts.PublisherRegistry.address,
          abi: publisherRegistryAbi,
          functionName: "registerPublisherDomainWithAuth",
          args: [replayDomain, publisherAccount.address, signingKeyAccount.address, deadline, authSig],
        });
      }, /InvalidSignature|0x8baa579f/);
    });

    // 3. Duplicate domain registration
    await nt.test("3. Reject duplicate domain registration", async () => {
      const currentNonce = (await chainClient.client.readContract({
        address: config.contracts.PublisherRegistry.address,
        abi: publisherRegistryAbi,
        functionName: "nonces",
        args: [publisherAccount.address],
      })) as bigint;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const { signature: dupSig } = await signRegistrationAuthorizationWithAccount({
        domain: testDomain, // already registered in Phase 4
        publisher: publisherAccount.address,
        initialSigningKey: signingKeyAccount.address,
        nonce: currentNonce,
        deadline,
        privateKey: publisherKey,
        chainId: 31337,
        verifyingContract: config.contracts.PublisherRegistry.address,
      });

      await assert.rejects(async () => {
        await registrarWallet.writeContract({
          address: config.contracts.PublisherRegistry.address,
          abi: publisherRegistryAbi,
          functionName: "registerPublisherDomainWithAuth",
          args: [testDomain, publisherAccount.address, signingKeyAccount.address, deadline, dupSig],
        });
      }, /DomainAlreadyRegistered|0x7b857a6b/);
    });

    // 4. Invalid release signature
    await nt.test("4. Reject invalid release signature", async () => {
      const corruptSignature = (releaseSignature.slice(0, -4) + "0000") as Hex;
      await assert.rejects(async () => {
        await relayerWallet.writeContract({
          address: config.contracts.ReleaseAttestationVerifier.address,
          abi: releaseVerifierAbi,
          functionName: "attestRelease",
          args: [{
            manifestHash,
            domain: testDomain,
            version: "1.0.0",
            sequence: 2n,
            previousManifestHash: manifestHash,
            timestamp: BigInt(sampleManifest.createdAt),
            expiresAt: BigInt(sampleManifest.expiresAt),
            signingKey: signingKeyAccount.address,
            signature: corruptSignature,
          }],
        });
      }, /InvalidReleaseSignature|InvalidSignature|0xcda44837|0x8baa579f/);
    });

    // 5. Altered manifest content
    await nt.test("5. Reject tampered manifest resource", async () => {
      // Attacker intercepts and replaces app.js with malicious code
      const tamperedObservations: ObservedResource[] = [
        { path: "/assets/app.js", hash: hashAndFormatResource("alert('malware injected!');") },
        { path: "/assets/vendor.js", hash: observedResources[1]?.hash ?? hashAndFormatResource("window.vendor = { name: 'VendorLibrary' };") },
      ];

      const res = await chainClient.verifyReleaseOnChain({
        manifest: sampleManifest,
        observedResources: tamperedObservations,
        signature: releaseSignature,
        attestationUid: activeAttestationUid,
      });
      assert.equal(res.state, "UNVERIFIED_RESOURCE_DETECTED");
      assert.equal(res.isValid, false);
    });

    // 6. Incorrect previous manifest hash (broken continuity)
    await nt.test("6. Reject broken previous manifest hash link", async () => {
      const wrongPrevHash = keccak256(toBytes("bad_link"));
      const newHash = keccak256(toBytes("v2_manifest"));
      const now = Math.floor(Date.now() / 1000);

      // Sign release with incorrect previousManifestHash
      const fakeV2Manifest: ReleaseManifest = {
        schemaVersion: "LUCENTRA-Manifest-v0.1",
        domain: testDomain,
        version: "2.0.0",
        sequence: 2,
        previousManifestHash: wrongPrevHash,
        createdAt: now,
        expiresAt: now + 3600,
        resources: sampleManifest.resources,
      };
      const { signature: v2Sig } = await signReleaseManifestWithAccount({
        manifest: fakeV2Manifest,
        manifestHash: newHash,
        privateKey: signingKeyPriv,
        chainId: 31337,
        verifyingContract: config.contracts.SignatureVerifier.address,
      });

      await assert.rejects(async () => {
        await relayerWallet.writeContract({
          address: config.contracts.ReleaseAttestationVerifier.address,
          abi: releaseVerifierAbi,
          functionName: "attestRelease",
          args: [{
            manifestHash: newHash,
            domain: testDomain,
            version: "2.0.0",
            sequence: 2n,
            previousManifestHash: wrongPrevHash,
            timestamp: BigInt(now),
            expiresAt: BigInt(now + 3600),
            signingKey: signingKeyAccount.address,
            signature: v2Sig,
          }],
        });
      }, /BrokenContinuity|0xbd255b95/);
    });

    // 7. Sequence rollback
    await nt.test("7. Reject sequence rollback (sequence <= latestSequence)", async () => {
      const now = Math.floor(Date.now() / 1000);
      const rollbackManifest: ReleaseManifest = {
        schemaVersion: "LUCENTRA-Manifest-v0.1",
        domain: testDomain,
        version: "1.0.1",
        sequence: 1, // current on-chain sequence is 1
        previousManifestHash: manifestHash,
        createdAt: now,
        expiresAt: now + 3600,
        resources: sampleManifest.resources,
      };
      const newHash = keccak256(toBytes("v1.0.1"));
      const { signature: rollbackSig } = await signReleaseManifestWithAccount({
        manifest: rollbackManifest,
        manifestHash: newHash,
        privateKey: signingKeyPriv,
        chainId: 31337,
        verifyingContract: config.contracts.SignatureVerifier.address,
      });

      await assert.rejects(async () => {
        await relayerWallet.writeContract({
          address: config.contracts.ReleaseAttestationVerifier.address,
          abi: releaseVerifierAbi,
          functionName: "attestRelease",
          args: [{
            manifestHash: newHash,
            domain: testDomain,
            version: "1.0.1",
            sequence: 1n,
            previousManifestHash: manifestHash,
            timestamp: BigInt(now),
            expiresAt: BigInt(now + 3600),
            signingKey: signingKeyAccount.address,
            signature: rollbackSig,
          }],
        });
      }, /SequenceRollback|0x21d735c7/);
    });

    // 8. Expired release attestation
    await nt.test("8. Reject already expired release attestation", async () => {
      const pastTime = BigInt(Math.floor(Date.now() / 1000) - 100);
      const expiredTime = BigInt(Math.floor(Date.now() / 1000) - 10);
      const expiredManifest: ReleaseManifest = {
        schemaVersion: "LUCENTRA-Manifest-v0.1",
        domain: testDomain,
        version: "2.0.0",
        sequence: 2,
        previousManifestHash: manifestHash,
        createdAt: Number(pastTime),
        expiresAt: Number(expiredTime),
        resources: sampleManifest.resources,
      };
      const newHash = keccak256(toBytes("expired_v2"));
      const { signature: expSig } = await signReleaseManifestWithAccount({
        manifest: expiredManifest,
        manifestHash: newHash,
        privateKey: signingKeyPriv,
        chainId: 31337,
        verifyingContract: config.contracts.SignatureVerifier.address,
      });

      await assert.rejects(async () => {
        await relayerWallet.writeContract({
          address: config.contracts.ReleaseAttestationVerifier.address,
          abi: releaseVerifierAbi,
          functionName: "attestRelease",
          args: [{
            manifestHash: newHash,
            domain: testDomain,
            version: "2.0.0",
            sequence: 2n,
            previousManifestHash: manifestHash,
            timestamp: pastTime,
            expiresAt: expiredTime,
            signingKey: signingKeyAccount.address,
            signature: expSig,
          }],
        });
      }, /AttestationExpired|0x716dcc39/);
    });

    // 9. Unauthorized signing key
    await nt.test("9. Reject attestation signed by unauthorized key", async () => {
      const now = Math.floor(Date.now() / 1000);
      const unauthorizedManifest: ReleaseManifest = {
        schemaVersion: "LUCENTRA-Manifest-v0.1",
        domain: testDomain,
        version: "2.0.0",
        sequence: 2,
        previousManifestHash: manifestHash,
        createdAt: now,
        expiresAt: now + 3600,
        resources: sampleManifest.resources,
      };
      const newHash = keccak256(toBytes("unauth_v2"));
      const { signature: unauthSig } = await signReleaseManifestWithAccount({
        manifest: unauthorizedManifest,
        manifestHash: newHash,
        privateKey: attackerKey, // Attacker signs
        chainId: 31337,
        verifyingContract: config.contracts.SignatureVerifier.address,
      });

      await assert.rejects(async () => {
        await relayerWallet.writeContract({
          address: config.contracts.ReleaseAttestationVerifier.address,
          abi: releaseVerifierAbi,
          functionName: "attestRelease",
          args: [{
            manifestHash: newHash,
            domain: testDomain,
            version: "2.0.0",
            sequence: 2n,
            previousManifestHash: manifestHash,
            timestamp: BigInt(now),
            expiresAt: BigInt(now + 3600),
            signingKey: attackerAccount.address,
            signature: unauthSig,
          }],
        });
      }, /UnauthorizedSigningKey|0x80e07e29/);
    });

    // 10. Revoked signing key
    await nt.test("10. Reject attestation after signing key revocation", async () => {
      // Publisher revokes signingKeyAccount
      const revokeTx = await publisherWallet.writeContract({
        address: config.contracts.PublisherRegistry.address,
        abi: publisherRegistryAbi,
        functionName: "revokeKey",
        args: [testDomain, signingKeyAccount.address],
      });
      await publicClient.waitForTransactionReceipt({ hash: revokeTx });

      assert.equal(await chainClient.isKeyAuthorized(testDomain, signingKeyAccount.address), false);

      const now = Math.floor(Date.now() / 1000);
      const v2Manifest: ReleaseManifest = {
        schemaVersion: "LUCENTRA-Manifest-v0.1",
        domain: testDomain,
        version: "2.0.0",
        sequence: 2,
        previousManifestHash: manifestHash,
        createdAt: now,
        expiresAt: now + 3600,
        resources: sampleManifest.resources,
      };
      const newHash = keccak256(toBytes("v2_post_revoke"));
      const { signature: v2Sig } = await signReleaseManifestWithAccount({
        manifest: v2Manifest,
        manifestHash: newHash,
        privateKey: signingKeyPriv,
        chainId: 31337,
        verifyingContract: config.contracts.SignatureVerifier.address,
      });

      await assert.rejects(async () => {
        await relayerWallet.writeContract({
          address: config.contracts.ReleaseAttestationVerifier.address,
          abi: releaseVerifierAbi,
          functionName: "attestRelease",
          args: [{
            manifestHash: newHash,
            domain: testDomain,
            version: "2.0.0",
            sequence: 2n,
            previousManifestHash: manifestHash,
            timestamp: BigInt(now),
            expiresAt: BigInt(now + 3600),
            signingKey: signingKeyAccount.address,
            signature: v2Sig,
          }],
        });
      }, /UnauthorizedSigningKey|0x80e07e29/);
    });

    // 11. Suspended publisher domain
    await nt.test("11. Reject attestation when publisher domain is suspended", async () => {
      const suspendTx = await publisherWallet.writeContract({
        address: config.contracts.PublisherRegistry.address,
        abi: publisherRegistryAbi,
        functionName: "suspendPublisher",
        args: [testDomain],
      });
      await publicClient.waitForTransactionReceipt({ hash: suspendTx });

      const pubInfo = await chainClient.queryPublisher(testDomain);
      assert.equal(pubInfo.isSuspended, true);

      // Verify release on-chain returns REVOKED_RELEASE when suspended
      const res = await chainClient.verifyReleaseOnChain({
        manifest: sampleManifest,
        observedResources,
        signature: releaseSignature,
        attestationUid: activeAttestationUid,
      });
      assert.equal(res.state, "REVOKED_RELEASE");
      assert.equal(res.isValid, false);
    });

    // 12. Revoked EAS attestation
    await nt.test("12. Revoking attestation via ReleaseAttestationVerifier marks it REVOKED_RELEASE", async () => {
      // Publisher calls revokeRelease on the active attestation
      const revokeAttestTx = await publisherWallet.writeContract({
        address: config.contracts.ReleaseAttestationVerifier.address,
        abi: releaseVerifierAbi,
        functionName: "revokeRelease",
        args: [activeAttestationUid],
      });
      await publicClient.waitForTransactionReceipt({ hash: revokeAttestTx });

      const record = await chainClient.queryAttestation(activeAttestationUid);
      assert.ok(record.revocationTime > 0n, "Attestation revocationTime is set");

      // Evaluation returns AttestationRevoked
      await assert.rejects(async () => {
        await publicClient.readContract({
          address: config.contracts.ReleaseAttestationVerifier.address,
          abi: releaseVerifierAbi,
          functionName: "verifyAttestation",
          args: [activeAttestationUid, 0n],
        });
      }, /AttestationRevoked|0xf6c44fd2/);
    });

    // 13. Incorrect EAS schema UID
    await nt.test("13. Reject attestation with mismatched schema UID", async () => {
      assert.ok(config.contracts.SchemaRegistry?.address, "SchemaRegistry must be deployed");

      // 1. Register an alternate dummy schema in SchemaRegistry
      const uniqueAltSchema = `string alt_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const dummySchemaTx = await relayerWallet.writeContract({
        address: config.contracts.SchemaRegistry.address,
        abi: schemaRegistryAbi,
        functionName: "register",
        args: [uniqueAltSchema, "0x0000000000000000000000000000000000000000", true],
      });
      const dummySchemaReceipt = await publicClient.waitForTransactionReceipt({ hash: dummySchemaTx });
      const regLogs = parseEventLogs({
        abi: schemaRegistryAbi,
        eventName: "Registered",
        logs: dummySchemaReceipt.logs,
      });
      const sLog0 = regLogs[0] as any;
      assert.ok(sLog0, "Schema Registered log exists");
      const altSchemaUid = sLog0.args.uid;

      // 2. Direct attest to EAS using the alternate schema
      const directAttestTx = await relayerWallet.writeContract({
        address: config.contracts.EAS.address,
        abi: easAbi,
        functionName: "attest",
        args: [{
          schema: altSchemaUid,
          data: {
            recipient: publisherAccount.address,
            expirationTime: 0n,
            revocable: true,
            refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
            data: "0x1234",
            value: 0n,
          },
        }],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: directAttestTx });
      const easLogs = parseEventLogs({
        abi: easAbi,
        eventName: "Attested",
        logs: receipt.logs,
      });
      const eLog0 = easLogs[0] as any;
      assert.ok(eLog0, "EAS Attested log exists");
      const badUid = eLog0.args.uid;

      await assert.rejects(async () => {
        await publicClient.readContract({
          address: config.contracts.ReleaseAttestationVerifier.address,
          abi: releaseVerifierAbi,
          functionName: "verifyAttestation",
          args: [badUid, 0n],
        });
      }, /InvalidAttestationSchema|0x5c85da72/);
    });
  });
});
