// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PublisherRegistry} from "src/PublisherRegistry.sol";
import {SignatureVerifier} from "src/SignatureVerifier.sol";
import {ReleaseAttestationVerifier} from "src/ReleaseAttestationVerifier.sol";
import {ISchemaRegistry} from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";
import {IEAS} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

contract DeployLocal is Script {
    function run()
        external
        returns (
            address schemaRegistryAddr,
            address easAddr,
            bytes32 schemaUID,
            address publisherRegistryAddr,
            address signatureVerifierAddr,
            address releaseVerifierAddr
        )
    {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address registrar = vm.envOr("REGISTRAR_ADDRESS", address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8));

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SchemaRegistry from official EAS deployment artifact
        schemaRegistryAddr = deployCode("lib/eas-contracts/deployments/sepolia/SchemaRegistry.json");
        console.log("SchemaRegistry deployed at:", schemaRegistryAddr);

        // 2. Deploy EAS with schemaRegistryAddr as constructor arg
        easAddr = deployCode("lib/eas-contracts/deployments/sepolia/EAS.json", abi.encode(schemaRegistryAddr));
        console.log("EAS deployed at:", easAddr);

        // 3. Register Release Schema on SchemaRegistry
        string memory schemaString =
            "bytes32 manifestHash,string domain,string version,uint64 sequence,bytes32 previousManifestHash,uint64 timestamp,uint64 expiresAt,address signingKey,bytes signature";
        schemaUID = ISchemaRegistry(schemaRegistryAddr).register(schemaString, ISchemaResolver(address(0)), true);
        console.log("Release Schema registered with UID:");
        console.logBytes32(schemaUID);

        // 4. Deploy PublisherRegistry
        PublisherRegistry publisherRegistry = new PublisherRegistry(registrar);
        publisherRegistryAddr = address(publisherRegistry);
        console.log("PublisherRegistry deployed at:", publisherRegistryAddr);

        // 5. Deploy SignatureVerifier
        SignatureVerifier signatureVerifier = new SignatureVerifier();
        signatureVerifierAddr = address(signatureVerifier);
        console.log("SignatureVerifier deployed at:", signatureVerifierAddr);

        // 6. Deploy ReleaseAttestationVerifier
        ReleaseAttestationVerifier releaseVerifier = new ReleaseAttestationVerifier(
            easAddr,
            publisherRegistryAddr,
            signatureVerifierAddr,
            schemaUID
        );
        releaseVerifierAddr = address(releaseVerifier);
        console.log("ReleaseAttestationVerifier deployed at:", releaseVerifierAddr);

        vm.stopBroadcast();
    }
}
