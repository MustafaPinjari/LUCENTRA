"""Blockchain client interacting with @lucentra/core CLI via typed JSON subprocess.

Complies with AGENTS.md Rules 2, 6, 7, 8, 19:
- Zero backend private key storage for publishers.
- Cryptographic verification via @lucentra/core / Viem.
- Typed subprocess execution with timeout and structured JSON output.
"""

import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional
from django.conf import settings

logger = logging.getLogger(__name__)


class BlockchainError(Exception):
    """Base exception for blockchain interaction errors."""
    pass


class BlockchainConnectionError(BlockchainError):
    """Raised when RPC or CLI fails to connect to node."""
    pass


class BlockchainExecutionError(BlockchainError):
    """Raised when on-chain execution or contract call reverts."""
    pass


class BlockchainClient:
    """Encapsulates interaction with the deployed smart contracts and @lucentra/core."""

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        cli_path: Optional[str] = None,
        deployment_path: Optional[str] = None,
        registrar_private_key: Optional[str] = None,
    ):
        self.rpc_url = rpc_url or getattr(settings, "ANVIL_RPC_URL", "http://127.0.0.1:8545")
        self.chain_id = getattr(settings, "CHAIN_ID", 31337)
        self.cli_path = cli_path or getattr(settings, "CORE_CLI_PATH", "")
        self.deployment_path = deployment_path or getattr(settings, "DEPLOYMENT_CONFIG_PATH", "")
        self.registrar_private_key = registrar_private_key or getattr(
            settings, "REGISTRAR_PRIVATE_KEY", None
        )
        self._deployment_cache: Optional[Dict[str, Any]] = None

    def get_deployment_config(self) -> Dict[str, Any]:
        """Load and cache local deployment manifest."""
        if self._deployment_cache is not None:
            return self._deployment_cache

        path = Path(self.deployment_path)
        if not path.is_absolute():
            path = (settings.BASE_DIR / path).resolve()

        if not path.exists():
            raise BlockchainConnectionError(
                f"Deployment configuration file not found at {path}"
            )

        try:
            with open(path, "r", encoding="utf-8") as f:
                self._deployment_cache = json.load(f)
            return self._deployment_cache
        except Exception as e:
            raise BlockchainConnectionError(f"Failed to read deployment config: {e}") from e

    def get_contract_addresses(self) -> Dict[str, str]:
        """Extract flat dictionary of contract addresses."""
        cfg = self.get_deployment_config()
        contracts = cfg.get("contracts", {})
        return {
            name: info.get("address") if isinstance(info, dict) else info
            for name, info in contracts.items()
        }

    def get_schema_uid(self) -> str:
        """Extract EAS schema UID from deployment config."""
        cfg = self.get_deployment_config()
        schema = cfg.get("schema", {})
        return schema.get("uid", "")

    def _run_cli_command(self, command: str, payload: Dict[str, Any], timeout: float = 20.0) -> Dict[str, Any]:
        """Execute a command against @lucentra/core CLI via stdin/stdout JSON subprocess."""
        cli_file = Path(self.cli_path)
        if not cli_file.is_absolute():
            cli_file = (settings.BASE_DIR / cli_file).resolve()

        if not cli_file.exists():
            raise BlockchainConnectionError(
                f"@lucentra/core CLI binary/script not found at {cli_file}. Run npm run build in packages/core."
            )

        cmd = ["node", str(cli_file), command]
        input_json = json.dumps(payload)

        try:
            result = subprocess.run(
                cmd,
                input=input_json,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as e:
            logger.error("CLI subprocess timed out on command '%s' after %s seconds", command, timeout)
            raise BlockchainConnectionError(f"CLI subprocess timed out: {e}") from e
        except Exception as e:
            logger.error("Failed to execute CLI subprocess: %s", e)
            raise BlockchainConnectionError(f"Failed to execute CLI subprocess: {e}") from e

        if result.returncode != 0:
            error_msg = result.stderr.strip() or result.stdout.strip()
            try:
                err_data = json.loads(error_msg)
                detail = err_data.get("error", error_msg)
            except Exception:
                detail = error_msg
            logger.warning("CLI command '%s' returned exit code %s: %s", command, result.returncode, detail)
            raise BlockchainExecutionError(f"Blockchain CLI error: {detail}")

        try:
            response = json.loads(result.stdout)
            return response
        except json.JSONDecodeError as e:
            logger.error("CLI returned invalid JSON: %s", result.stdout)
            raise BlockchainExecutionError(f"CLI returned invalid JSON response: {e}") from e

    def check_readiness(self) -> Dict[str, Any]:
        """Check RPC connection, contract code existence, and EAS schema validity."""
        contracts = self.get_contract_addresses()
        schema_uid = self.get_schema_uid()

        payload = {
            "rpcUrl": self.rpc_url,
            "expectedChainId": self.chain_id,
            "contracts": contracts,
            "schemaUid": schema_uid,
        }
        res = self._run_cli_command("check-readiness", payload)
        return {
            "rpcConnected": res.get("rpcConnected", False),
            "chainId": res.get("chainId", 0),
            "contractsReady": res.get("contractsReady", False),
            "schemaReady": res.get("schemaReady", False),
        }

    def verify_registration_auth(
        self,
        domain: str,
        publisher: str,
        initial_signing_key: str,
        nonce: int,
        deadline: int,
        signature: str,
    ) -> Dict[str, Any]:
        """Verify publisher EIP-712 registration authorization signature without submitting."""
        contracts = self.get_contract_addresses()
        publisher_registry = contracts.get("PublisherRegistry")
        if not publisher_registry:
            raise BlockchainConnectionError("PublisherRegistry address not configured.")

        payload = {
            "domain": domain,
            "publisher": publisher,
            "initialSigningKey": initial_signing_key,
            "nonce": nonce,
            "deadline": deadline,
            "signature": signature,
            "chainId": self.chain_id,
            "verifyingContract": publisher_registry,
        }
        return self._run_cli_command("verify-registration-auth", payload)

    def get_nonce(self, publisher: str) -> int:
        """Query current registration nonce for publisher from PublisherRegistry."""
        contracts = self.get_contract_addresses()
        payload = {
            "rpcUrl": self.rpc_url,
            "publisherRegistry": contracts.get("PublisherRegistry"),
            "publisher": publisher,
        }
        res = self._run_cli_command("get-nonce", payload)
        return int(res.get("nonce", 0))

    def query_publisher(self, domain: str) -> Dict[str, Any]:
        """Query on-chain domain owner and suspension status."""
        contracts = self.get_contract_addresses()
        payload = {
            "rpcUrl": self.rpc_url,
            "publisherRegistry": contracts.get("PublisherRegistry"),
            "domain": domain,
        }
        res = self._run_cli_command("query-publisher", payload)
        if "publisher" in res and isinstance(res["publisher"], dict):
            return {
                "isRegistered": res.get("isRegistered", True),
                **res["publisher"],
            }
        return res

    def is_key_authorized(self, domain: str, signing_key: str) -> bool:
        """Query whether signingKey is currently authorized on-chain for domain."""
        contracts = self.get_contract_addresses()
        payload = {
            "rpcUrl": self.rpc_url,
            "publisherRegistry": contracts.get("PublisherRegistry"),
            "domain": domain,
            "signingKey": signing_key,
        }
        res = self._run_cli_command("is-key-authorized", payload)
        return bool(res.get("isAuthorized", False))

    def register_domain(
        self,
        domain: str,
        publisher: str,
        initial_signing_key: str,
        deadline: int,
        signature: str,
    ) -> Dict[str, Any]:
        """Execute on-chain domain registration via registrar account."""
        if not self.registrar_private_key:
            raise BlockchainExecutionError(
                "Registrar private key is not configured in backend environment."
            )

        contracts = self.get_contract_addresses()
        payload = {
            "rpcUrl": self.rpc_url,
            "publisherRegistry": contracts.get("PublisherRegistry"),
            "domain": domain,
            "publisher": publisher,
            "initialSigningKey": initial_signing_key,
            "deadline": deadline,
            "signature": signature,
            "registrarPrivateKey": self.registrar_private_key,
        }
        return self._run_cli_command("register-domain", payload, timeout=30.0)

    def query_attestation(self, attestation_uid: str) -> Dict[str, Any]:
        """Query release attestation status from EAS and ReleaseAttestationVerifier."""
        contracts = self.get_contract_addresses()
        payload = {
            "rpcUrl": self.rpc_url,
            "eas": contracts.get("EAS"),
            "releaseVerifier": contracts.get("ReleaseAttestationVerifier"),
            "attestationUid": attestation_uid,
        }
        return self._run_cli_command("query-attestation", payload)

    def query_latest_release(self, domain: str) -> Dict[str, Any]:
        """Query latest sequence and manifest hash for domain."""
        contracts = self.get_contract_addresses()
        payload = {
            "rpcUrl": self.rpc_url,
            "releaseVerifier": contracts.get("ReleaseAttestationVerifier"),
            "domain": domain,
        }
        return self._run_cli_command("query-latest-release", payload)

    def attest_release(self, data: Dict[str, Any], relayer_private_key: Optional[str] = None) -> Dict[str, Any]:
        """Submit release attestation to EAS via ReleaseAttestationVerifier."""
        key = relayer_private_key or self.registrar_private_key
        if not key:
            raise BlockchainExecutionError("Relayer/Registrar private key not configured.")

        contracts = self.get_contract_addresses()
        payload = {
            "rpcUrl": self.rpc_url,
            "releaseVerifier": contracts.get("ReleaseAttestationVerifier"),
            "data": data,
            "relayerPrivateKey": key,
        }
        return self._run_cli_command("attest-release", payload, timeout=30.0)

    def verify_release(
        self,
        manifest: Dict[str, Any],
        observed_resources: Dict[str, str],
        signature: str,
        attestation_uid: Optional[str] = None,
        evaluation_time: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Verify release manifest, resources, signature, and on-chain attestation status."""
        cfg = self.get_deployment_config()
        raw_contracts = cfg.get("contracts", {})
        norm_contracts = {
            name: {"address": info["address"]} if isinstance(info, dict) else {"address": info}
            for name, info in raw_contracts.items()
        }

        deployment_config = {
            "rpcUrl": self.rpc_url,
            "chainId": self.chain_id,
            "schema": cfg.get("schema", {"uid": self.get_schema_uid(), "raw": ""}),
            "contracts": norm_contracts,
        }

        payload = {
            "config": deployment_config,
            "manifest": manifest,
            "observedResources": observed_resources,
            "signature": signature,
            "attestationUid": attestation_uid,
            "evaluationTime": evaluation_time,
        }
        return self._run_cli_command("verify-release", payload, timeout=30.0)


# Singleton instance helper
_client_instance: Optional[BlockchainClient] = None


def get_blockchain_client() -> BlockchainClient:
    """Return singleton BlockchainClient instance."""
    global _client_instance
    if _client_instance is None:
        _client_instance = BlockchainClient()
    return _client_instance
