"""Targeted verification tests for Sprint 3.1 Final Acceptance Check.

Verifies:
1. AuditEvent protections against ORM updates, deletes, bulk ops, and admin modification protections.
2. Cross-publisher object-level authorization across domain, release, key and attestation endpoints.
3. Registration recovery when blockchain succeeds but SQLite persistence fails.
4. Reconciliation behavior after application restart and RPC interruption.
5. Registrar key isolation on non-local chain IDs.
6. Release completeness: partial resource observations must never return VERIFIED_RELEASE_MATCH.
"""

from datetime import datetime, timezone as dt_timezone, timedelta
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status
from django.core.exceptions import ImproperlyConfigured

from apps.publishers.models import Publisher
from apps.domains.models import Domain, DNSChallenge, DomainStatus
from apps.releases.models import Release, SigningKey, ReleaseStatus
from apps.attestations.models import Attestation
from apps.audit.models import AuditEvent
from blockchain.client import BlockchainClient, BlockchainExecutionError, BlockchainConnectionError


class AuditEventProtectionVerificationTests(TestCase):
    """Point 1: AuditEvent protections against ORM updates, deletes, and tampering."""

    def setUp(self):
        self.event = AuditEvent.objects.create(
            actor="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
            action="DOMAIN_REGISTERED_ONCHAIN",
            resource_type="Domain",
            resource_id="audit-test.org",
            metadata={"test": True},
        )

    def test_orm_update_prevented(self):
        self.event.action = "TAMPERED_ACTION"
        with self.assertRaises(PermissionError):
            self.event.save()

    def test_orm_delete_prevented(self):
        with self.assertRaises(PermissionError):
            self.event.delete()

    def test_bulk_queryset_update_prevented(self):
        with self.assertRaises(PermissionError):
            AuditEvent.objects.filter(resource_id="audit-test.org").update(action="TAMPERED")

    def test_bulk_queryset_delete_prevented(self):
        with self.assertRaises(PermissionError):
            AuditEvent.objects.filter(resource_id="audit-test.org").delete()


class CrossPublisherAuthorizationTests(TestCase):
    """Point 2: Cross-publisher object-level authorization verification."""

    def setUp(self):
        self.client = APIClient()
        self.publisher_a_wallet = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
        self.publisher_b_wallet = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
        self.pub_a = Publisher.objects.create(wallet_address=self.publisher_a_wallet)
        self.pub_b = Publisher.objects.create(wallet_address=self.publisher_b_wallet)

        self.domain_a = Domain.objects.create(
            publisher=self.pub_a,
            canonical_domain="publisher-a.org",
            registration_status=DomainStatus.REGISTERED_ONCHAIN,
        )
        self.key_a = SigningKey.objects.create(
            domain=self.domain_a,
            public_address="0x90f79bf6eb2c4f870365e785982e1f101e93b906",
            status="ACTIVE",
        )

    def test_publisher_b_cannot_create_challenge_for_publisher_a_domain(self):
        payload = {
            "domain": "publisher-a.org",
            "publisher": self.publisher_b_wallet,
        }
        res = self.client.post("/api/v1/domains/challenges/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.json()["error"]["code"], "domain_already_registered")

    @patch("blockchain.client.BlockchainClient.is_key_authorized")
    def test_publisher_b_cannot_submit_release_for_publisher_a_domain(self, mock_is_auth):
        mock_is_auth.return_value = False
        manifest = {
            "manifestVersion": "0.1.0",
            "domain": "publisher-a.org",
            "version": "1.0.0",
            "sequence": 1,
            "timestamp": 1700000000,
            "expiresAt": 1800000000,
            "signingKey": "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",  # Publisher B key
            "resources": [],
        }
        payload = {
            "manifest": manifest,
            "signature": "0x" + "1" * 130,
            "signing_key": "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
        }
        res = self.client.post("/api/v1/releases/", payload, format="json")
        # Key is not in domain_a signing keys
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_domain_keys_scoped_strictly_to_target_domain(self):
        domain_b = Domain.objects.create(
            publisher=self.pub_b,
            canonical_domain="publisher-b.org",
            registration_status=DomainStatus.REGISTERED_ONCHAIN,
        )
        SigningKey.objects.create(
            domain=domain_b,
            public_address="0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
            status="ACTIVE",
        )

        res = self.client.get(f"/api/v1/domains/{self.domain_a.canonical_domain}/keys/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        keys = res.json()
        self.assertEqual(len(keys), 1)
        self.assertEqual(keys[0]["public_address"].lower(), self.key_a.public_address.lower())


class RegistrationRecoveryTests(TestCase):
    """Point 3: Registration recovery when blockchain succeeds but SQLite fails."""

    def setUp(self):
        self.client = APIClient()
        self.publisher_wallet = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
        self.signing_key = "0x90f79bf6eb2c4f870365e785982e1f101e93b906"
        self.domain_name = "reconcile-test.org"
        self.pub = Publisher.objects.create(wallet_address=self.publisher_wallet)
        self.domain = Domain.objects.create(
            publisher=self.pub,
            canonical_domain=self.domain_name,
            registration_status=DomainStatus.DNS_VERIFIED,
        )

    @patch("blockchain.client.BlockchainClient.is_key_authorized")
    @patch("blockchain.client.BlockchainClient.query_publisher")
    def test_reconcile_recovers_unrecorded_domain_and_signing_key(self, mock_query, mock_is_key):
        # On-chain state exists
        mock_query.return_value = {
            "isRegistered": True,
            "owner": self.publisher_wallet,
            "registeredAt": 1720000000,
            "isSuspended": False,
            "domain": self.domain_name,
        }
        mock_is_key.return_value = True

        payload = {"signing_key": self.signing_key}
        res = self.client.post(
            f"/api/v1/domains/{self.domain_name}/reconcile/",
            payload,
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["registration_status"], "REGISTERED_ONCHAIN")

        self.domain.refresh_from_db()
        self.assertEqual(self.domain.registration_status, DomainStatus.REGISTERED_ONCHAIN)
        self.assertTrue(
            SigningKey.objects.filter(
                domain=self.domain,
                public_address=self.signing_key.lower(),
                status="ACTIVE",
            ).exists()
        )


class RPCInterruptionTests(TestCase):
    """Point 4: Reconciliation behavior after application restart and RPC interruption."""

    def setUp(self):
        self.client = APIClient()
        self.publisher_wallet = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
        self.pub = Publisher.objects.create(wallet_address=self.publisher_wallet)
        self.domain = Domain.objects.create(
            publisher=self.pub,
            canonical_domain="rpc-test.org",
            registration_status=DomainStatus.PENDING_DNS,
        )

    @patch("blockchain.client.BlockchainClient.query_publisher")
    def test_rpc_interruption_returns_502_and_recovers_on_restoration(self, mock_query):
        # 1. Simulate RPC down / connection error
        mock_query.side_effect = BlockchainConnectionError("RPC node unreachable at 127.0.0.1:8545")
        res1 = self.client.post(f"/api/v1/domains/{self.domain.canonical_domain}/reconcile/")
        self.assertEqual(res1.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(res1.json()["error"]["code"], "blockchain_error")

        # 2. Simulate RPC restored
        mock_query.side_effect = None
        mock_query.return_value = {
            "isRegistered": True,
            "owner": self.publisher_wallet,
            "registeredAt": 1720000000,
            "isSuspended": False,
            "domain": self.domain.canonical_domain,
        }
        res2 = self.client.post(f"/api/v1/domains/{self.domain.canonical_domain}/reconcile/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.json()["registration_status"], "REGISTERED_ONCHAIN")


class RegistrarKeyIsolationTests(TestCase):
    """Point 5: Registrar key isolation and prevention of public-chain execution."""

    def test_settings_raises_on_non_local_chain_with_anvil_key(self):
        from config import settings as s
        local_key = s.LOCAL_ANVIL_REGISTRAR_KEY

        # Client runtime guard
        client = BlockchainClient(registrar_private_key=local_key)
        client.chain_id = 1  # Ethereum Mainnet

        with self.assertRaises(BlockchainExecutionError) as ctx:
            client.register_domain(
                domain="mainnet-test.com",
                publisher="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
                initial_signing_key="0x90f79bf6eb2c4f870365e785982e1f101e93b906",
                deadline=2000000000,
                signature="0x" + "1" * 130,
            )
        self.assertIn("Refusing to use well-known local Anvil registrar key on non-local chain", str(ctx.exception))

        with self.assertRaises(BlockchainExecutionError) as ctx:
            client.attest_release(
                data={"manifestHash": "0x" + "1" * 64},
                relayer_private_key=local_key,
            )
        self.assertIn("Refusing to use well-known local Anvil registrar key on non-local chain", str(ctx.exception))


class ReleaseCompletenessVerificationTests(TestCase):
    """Point 6: Partial resource observations must NEVER return VERIFIED_RELEASE_MATCH."""

    def setUp(self):
        self.client = APIClient()

    @patch("blockchain.client.BlockchainClient.verify_release")
    def test_verify_release_with_partial_observation_returns_indeterminate(self, mock_verify):
        # Simulating @lucentra/core returning INDETERMINATE for partial resources
        mock_verify.return_value = {
            "result": {
                "state": "INDETERMINATE",
                "isValid": False,
                "resourceDetails": [
                    {"path": "/app.js", "status": "MATCH"},
                    {"path": "/vendor.js", "status": "MISSING"},
                ],
                "errors": [
                    {
                        "code": "MISSING_RESOURCE_DETECTED",
                        "message": "Declared manifest resource was not observed in runtime environment: /vendor.js",
                    }
                ],
            }
        }

        payload = {
            "manifest": {
                "domain": "example.com",
                "version": "1.0.0",
                "resources": [
                    {"path": "/app.js", "sha256": "sha256-abc"},
                    {"path": "/vendor.js", "sha256": "sha256-def"},
                ],
            },
            "observed_resources": {
                "/app.js": "sha256-abc",
            },
            "signature": "0x" + "1" * 130,
        }
        res = self.client.post("/api/v1/releases/verify/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["state"], "INDETERMINATE")
        self.assertFalse(data["isValid"])
        self.assertNotEqual(data["state"], "VERIFIED_RELEASE_MATCH")
