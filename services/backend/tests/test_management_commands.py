from io import StringIO
from django.test import TestCase
from django.core.management import call_command
from unittest.mock import patch
from apps.publishers.models import Publisher
from apps.domains.models import Domain, DomainStatus
from apps.releases.models import SigningKey, Release
from apps.attestations.models import Attestation


class SyncAttestationsCommandTestCase(TestCase):
    def setUp(self):
        self.pub = Publisher.objects.create(wallet_address="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc")
        self.dom = Domain.objects.create(
            publisher=self.pub,
            canonical_domain="sync-test.com",
            registration_status=DomainStatus.REGISTERED_ONCHAIN,
        )
        self.key = SigningKey.objects.create(
            domain=self.dom,
            public_address="0x90f79bf6eb2c4f870365e785982e1f101e93b906",
        )
        self.release = Release.objects.create(
            domain=self.dom,
            manifest_hash="0x" + "1" * 64,
            version="1.0.0",
            sequence=1,
            previous_manifest_hash="0x" + "0" * 64,
            signing_key=self.key,
            timestamp=1700000000,
            expires_at=1800000000,
            signature="0x" + "a" * 130,
            manifest_json={},
            attestation_uid="0x" + "9" * 64,
        )

    @patch("blockchain.client.BlockchainClient.query_attestation")
    def test_sync_attestations_command_success(self, mock_query):
        mock_query.return_value = {
            "isValid": True,
            "attestation": {"revocationTime": 0},
            "publisher": self.pub.wallet_address,
        }

        out = StringIO()
        call_command("sync_attestations", stdout=out)
        output = out.getvalue()

        self.assertIn("Sync completed", output)
        self.assertIn("Successfully synced: 1", output)

        att = Attestation.objects.get(uid="0x" + "9" * 64)
        self.assertEqual(att.release, self.release)
        self.assertFalse(att.revoked)
