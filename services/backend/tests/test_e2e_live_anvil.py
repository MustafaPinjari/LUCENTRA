"""Live end-to-end integration test against running local Anvil blockchain.

Executes real registration, cryptographic signing, on-chain mining,
EAS attestation, and verification.
"""

import json
import secrets
import subprocess
from pathlib import Path
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from django.conf import settings
from unittest.mock import patch, MagicMock
from apps.domains.models import Domain, DNSChallenge, DomainStatus
from apps.domains.dns_service import DNSService
from tests.test_dns_service import MockTXTAnswer
from apps.releases.models import Release, SigningKey
from apps.attestations.models import Attestation
from blockchain.client import get_blockchain_client


class LiveAnvilE2ETestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Verify Anvil is reachable before running live tests
        client = get_blockchain_client()
        try:
            readiness = client.check_readiness()
            cls.anvil_ready = (
                readiness.get("rpcConnected")
                and readiness.get("contractsReady")
                and readiness.get("schemaReady")
            )
        except Exception:
            cls.anvil_ready = False

    def setUp(self):
        if not getattr(self, "anvil_ready", False):
            self.skipTest("Local Anvil blockchain is not reachable or contracts not deployed.")
        self.client = APIClient()
        self.domain_name = f"e2e-{secrets.token_hex(4)}.org"
        self.publisher_wallet = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
        self.publisher_pk = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
        self.signing_key = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
        self.signing_key_pk = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"

    def _generate_publisher_signature(self, nonce: int, deadline: int) -> str:
        """Call CLI to sign real EIP-712 registration authorization."""
        client = get_blockchain_client()
        contracts = client.get_contract_addresses()
        payload = {
            "domain": self.domain_name,
            "publisher": self.publisher_wallet,
            "initialSigningKey": self.signing_key,
            "nonce": nonce,
            "deadline": deadline,
            "privateKey": self.publisher_pk,
            "chainId": 31337,
            "verifyingContract": contracts["PublisherRegistry"],
        }
        res = client._run_cli_command("sign-registration-auth", payload)
        return res["signature"]

    def _generate_release_signature(self, manifest: dict) -> str:
        """Call CLI to sign real RFC 8785 release manifest."""
        client = get_blockchain_client()
        contracts = client.get_contract_addresses()
        payload = {
            "manifest": manifest,
            "privateKey": self.signing_key_pk,
            "chainId": 31337,
            "verifyingContract": contracts["SignatureVerifier"],
        }
        res = client._run_cli_command("sign-release", payload)
        return res["signature"]

    def test_complete_live_lifecycle(self):
        # 1. Check readiness endpoint returns 200 OK
        readiness_resp = self.client.get("/api/v1/readiness/")
        self.assertEqual(readiness_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(readiness_resp.json()["status"], "ready")

        # 2. Request DNS challenge
        chal_resp = self.client.post(
            "/api/v1/domains/challenges/",
            {"domain": self.domain_name, "publisher": self.publisher_wallet},
            format="json",
        )
        self.assertEqual(chal_resp.status_code, status.HTTP_201_CREATED)
        chal_data = chal_resp.json()
        challenge_id = chal_data["id"]

        # 3. Verify DNS challenge via test double resolver
        mock_resolver = MagicMock()
        mock_resolver.resolve.return_value = [
            MockTXTAnswer(chal_data["record_value"])
        ]
        test_dns_service = DNSService(resolver=mock_resolver)
        with patch("apps.domains.views.get_dns_service", return_value=test_dns_service):
            verify_resp = self.client.post(
                "/api/v1/domains/verify-dns/",
                {"domain": self.domain_name, "challenge_id": challenge_id},
                format="json",
            )
            self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
            self.assertTrue(verify_resp.json()["verified"])

        # 4. Fetch current on-chain nonce for publisher
        client = get_blockchain_client()
        current_nonce = client.get_nonce(self.publisher_wallet)

        # 5. Generate real EIP-712 signature from publisher wallet
        deadline = 2000000000
        sig = self._generate_publisher_signature(current_nonce, deadline)
        self.assertTrue(sig.startswith("0x"))

        # 6. Submit registration to local Anvil
        reg_resp = self.client.post(
            "/api/v1/domains/register/",
            {
                "domain": self.domain_name,
                "publisher": self.publisher_wallet,
                "initial_signing_key": self.signing_key,
                "deadline": deadline,
                "signature": sig,
            },
            format="json",
        )
        self.assertEqual(reg_resp.status_code, status.HTTP_201_CREATED)
        reg_data = reg_resp.json()
        self.assertEqual(reg_data["status"], "REGISTERED_ONCHAIN")
        self.assertTrue(reg_data["transaction_hash"].startswith("0x"))

        # 7. Check on-chain state directly
        pub_info = client.query_publisher(self.domain_name)
        self.assertEqual(pub_info["owner"].lower(), self.publisher_wallet.lower())
        self.assertFalse(pub_info["isSuspended"])

        is_auth = client.is_key_authorized(self.domain_name, self.signing_key)
        self.assertTrue(is_auth)

        # 8. Submit signed release to EAS
        now = int(timezone.now().timestamp())
        content = "console.log('hello lucentra');"
        # sha256 of content
        import hashlib
        content_hash = "sha256:" + hashlib.sha256(content.encode("utf-8")).hexdigest()

        manifest = {
            "schemaVersion": "LUCENTRA-Manifest-v0.1",
            "domain": self.domain_name,
            "version": "1.0.0",
            "sequence": 1,
            "previousManifestHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "createdAt": now,
            "expiresAt": now + 86400 * 30,
            "resources": [
                {
                    "path": "/assets/app.js",
                    "size": len(content.encode("utf-8")),
                    "sha256": content_hash,
                    "type": "script",
                }
            ],
        }
        rel_sig = self._generate_release_signature(manifest)

        rel_resp = self.client.post(
            "/api/v1/releases/",
            {
                "manifest": manifest,
                "signature": rel_sig,
                "signing_key": self.signing_key,
                "observed_resources": {
                    "/assets/app.js": content,
                },
            },
            format="json",
        )
        self.assertEqual(rel_resp.status_code, status.HTTP_201_CREATED)
        rel_data = rel_resp.json()
        attestation_uid = rel_data["attestation_uid"]
        self.assertTrue(attestation_uid.startswith("0x"))

        # 9. Query live attestation from EAS
        att_resp = self.client.get(f"/api/v1/attestations/{attestation_uid}/?live=true")
        self.assertEqual(att_resp.status_code, status.HTTP_200_OK)
        att_data = att_resp.json()
        self.assertEqual(att_data["uid"], attestation_uid)
        self.assertTrue(att_data["live_onchain"]["isValid"])
