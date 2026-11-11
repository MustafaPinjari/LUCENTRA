"""Security & reliability reproduction test suite for Sprint 3.1 Audit.

Covers:
- Finding 1: Registrar private key safety assertions on non-local chains
- Finding 2: Object-level access control and disallowance of unsafe REST methods (PUT, PATCH, DELETE)
- Finding 3: AuditEvent strict immutability enforcement (save, delete, bulk update, bulk delete)
- Finding 4: Subprocess command allowlist enforcement & credential redaction
- Finding 5: Atomic registration & on-chain reconciliation
- Finding 6: Domain normalization and RFC 1035 / IDN defense
"""

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.core.exceptions import ImproperlyConfigured

from apps.publishers.models import Publisher
from apps.domains.models import Domain, DNSChallenge, DomainStatus, normalize_domain_name
from apps.releases.models import Release, SigningKey, ReleaseStatus
from apps.audit.models import AuditEvent
from blockchain.client import BlockchainClient, BlockchainExecutionError, redact_sensitive_data


class AuditEventImmutabilityTests(TestCase):
    """Verify that AuditEvent instances and querysets are strictly append-only."""

    def test_audit_event_creation_succeeds(self):
        event = AuditEvent.objects.create(
            actor="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
            action="DOMAIN_REGISTERED_ONCHAIN",
            resource_type="Domain",
            resource_id="example.com",
            metadata={"tx": "0x123"},
        )
        self.assertIsNotNone(event.pk)
        self.assertEqual(event.action, "DOMAIN_REGISTERED_ONCHAIN")

    def test_audit_event_update_raises_permission_error(self):
        event = AuditEvent.objects.create(
            actor="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
            action="TEST_ACTION",
            resource_type="Test",
            resource_id="1",
        )
        event.action = "TAMPERED_ACTION"
        with self.assertRaises(PermissionError):
            event.save()

    def test_audit_event_delete_raises_permission_error(self):
        event = AuditEvent.objects.create(
            actor="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
            action="TEST_ACTION",
            resource_type="Test",
            resource_id="1",
        )
        with self.assertRaises(PermissionError):
            event.delete()

    def test_audit_event_queryset_bulk_delete_raises_permission_error(self):
        AuditEvent.objects.create(
            actor="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
            action="ACTION_A",
            resource_type="Test",
            resource_id="1",
        )
        with self.assertRaises(PermissionError):
            AuditEvent.objects.filter(action="ACTION_A").delete()

    def test_audit_event_queryset_bulk_update_raises_permission_error(self):
        AuditEvent.objects.create(
            actor="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
            action="ACTION_B",
            resource_type="Test",
            resource_id="2",
        )
        with self.assertRaises(PermissionError):
            AuditEvent.objects.filter(action="ACTION_B").update(action="TAMPERED")


class BlockchainSecurityGuardsTests(TestCase):
    """Verify CLI command allowlist, credential redaction, and chain safety guards."""

    def setUp(self):
        self.client = BlockchainClient()

    def test_command_allowlist_rejects_unapproved_command(self):
        with self.assertRaises(BlockchainExecutionError) as ctx:
            self.client._run_cli_command("malicious-command; rm -rf /", {})
        self.assertIn("not in the approved CLI command whitelist", str(ctx.exception))

    def test_refuse_anvil_dev_key_on_non_local_chain(self):
        # Local anvil key on Sepolia (chain 11155111) must be rejected
        remote_client = BlockchainClient(
            registrar_private_key="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
        )
        remote_client.chain_id = 11155111  # Sepolia

        with self.assertRaises(BlockchainExecutionError) as ctx:
            remote_client.register_domain(
                domain="example.com",
                publisher="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
                initial_signing_key="0x90f79bf6eb2c4f870365e785982e1f101e93b906",
                deadline=2000000000,
                signature="0x" + "1" * 130,
            )
        self.assertIn("Refusing to use well-known local Anvil registrar key", str(ctx.exception))

    def test_redact_sensitive_private_key(self):
        test_str = "Error during signing with 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d at contract"
        redacted = redact_sensitive_data(test_str)
        self.assertNotIn("59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", redacted)
        self.assertIn("[REDACTED_KEY]", redacted)


class ViewSetAccessControlTests(TestCase):
    """Verify that unauthenticated / arbitrary REST mutations are disabled on ViewSets."""

    def setUp(self):
        self.client = APIClient()
        self.publisher = Publisher.objects.create(
            wallet_address="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
            display_name="Test Publisher",
        )
        self.domain = Domain.objects.create(
            publisher=self.publisher,
            canonical_domain="portal.org",
            registration_status=DomainStatus.REGISTERED_ONCHAIN,
        )
        self.key = SigningKey.objects.create(
            domain=self.domain,
            public_address="0x90f79bf6eb2c4f870365e785982e1f101e93b906",
            status="ACTIVE",
        )
        self.release = Release.objects.create(
            domain=self.domain,
            manifest_hash="0x" + "a" * 64,
            version="1.0.0",
            sequence=1,
            previous_manifest_hash="0x0000000000000000000000000000000000000000000000000000000000000000",
            signing_key=self.key,
            timestamp=1700000000,
            expires_at=1800000000,
            signature="0x" + "2" * 130,
            manifest_json={},
            status=ReleaseStatus.ATTESTED,
        )

    def test_publisher_mutation_methods_disallowed(self):
        # POST
        res_post = self.client.post("/api/v1/publishers/", {"wallet_address": "0x123"}, format="json")
        self.assertEqual(res_post.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # PUT
        res_put = self.client.put(
            f"/api/v1/publishers/{self.publisher.wallet_address}/",
            {"display_name": "Tampered"},
            format="json",
        )
        self.assertEqual(res_put.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # PATCH
        res_patch = self.client.patch(
            f"/api/v1/publishers/{self.publisher.wallet_address}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res_patch.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # DELETE
        res_del = self.client.delete(f"/api/v1/publishers/{self.publisher.wallet_address}/")
        self.assertEqual(res_del.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_domain_mutation_methods_disallowed(self):
        # Direct POST
        res_post = self.client.post("/api/v1/domains/", {"canonical_domain": "evil.com"}, format="json")
        self.assertEqual(res_post.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Direct PUT
        res_put = self.client.put(
            f"/api/v1/domains/{self.domain.canonical_domain}/",
            {"registration_status": "SUSPENDED"},
            format="json",
        )
        self.assertEqual(res_put.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Direct PATCH
        res_patch = self.client.patch(
            f"/api/v1/domains/{self.domain.canonical_domain}/",
            {"registration_status": "REVOKED"},
            format="json",
        )
        self.assertEqual(res_patch.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Direct DELETE
        res_del = self.client.delete(f"/api/v1/domains/{self.domain.canonical_domain}/")
        self.assertEqual(res_del.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_release_mutation_methods_disallowed(self):
        # Direct PUT
        res_put = self.client.put(
            f"/api/v1/releases/{self.release.id}/",
            {"version": "2.0.0"},
            format="json",
        )
        self.assertEqual(res_put.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Direct PATCH
        res_patch = self.client.patch(
            f"/api/v1/releases/{self.release.id}/",
            {"status": "REVOKED"},
            format="json",
        )
        self.assertEqual(res_patch.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        # Direct DELETE
        res_del = self.client.delete(f"/api/v1/releases/{self.release.id}/")
        self.assertEqual(res_del.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class OnChainReconciliationTests(TestCase):
    """Verify synchronization and reconciliation from on-chain truth into SQLite."""

    def setUp(self):
        self.client = APIClient()
        self.publisher_wallet = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
        self.pub = Publisher.objects.create(wallet_address=self.publisher_wallet)
        self.domain = Domain.objects.create(
            publisher=self.pub,
            canonical_domain="out-of-sync.org",
            registration_status=DomainStatus.PENDING_DNS,
        )

    @patch("blockchain.client.BlockchainClient.query_publisher")
    def test_reconcile_domain_syncs_onchain_registration(self, mock_query):
        mock_query.return_value = {
            "isRegistered": True,
            "owner": self.publisher_wallet,
            "registeredAt": 1710000000,
            "isSuspended": False,
            "domain": "out-of-sync.org",
        }

        response = self.client.post(f"/api/v1/domains/{self.domain.canonical_domain}/reconcile/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["registration_status"], "REGISTERED_ONCHAIN")

        self.domain.refresh_from_db()
        self.assertEqual(self.domain.registration_status, DomainStatus.REGISTERED_ONCHAIN)
        self.assertIsNotNone(self.domain.registered_at)


class DomainNormalizationTests(TestCase):
    """Verify domain normalization and IDN / Punycode handling."""

    def test_normalize_valid_ascii_domain(self):
        self.assertEqual(normalize_domain_name("EXAMPLE.COM."), "example.com")
        self.assertEqual(normalize_domain_name("  sub.domain.org  "), "sub.domain.org")

    def test_normalize_punycode_idn_domain(self):
        # München.de in punycode is xn--mnchen-3ya.de
        self.assertEqual(normalize_domain_name("münchen.de"), "xn--mnchen-3ya.de")

    def test_normalize_rejects_consecutive_dots_or_invalid(self):
        self.assertEqual(normalize_domain_name("bad..domain.com"), "")
        self.assertEqual(normalize_domain_name("-bad.com"), "")
        self.assertEqual(normalize_domain_name(""), "")
