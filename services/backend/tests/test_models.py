from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from apps.publishers.models import Publisher
from apps.domains.models import Domain, DNSChallenge, DomainStatus
from apps.releases.models import SigningKey, Release, ReleaseStatus
from apps.attestations.models import Attestation
from apps.audit.models import AuditEvent


class PublisherModelTestCase(TestCase):
    def test_create_publisher_normalizes_address(self):
        pub = Publisher.objects.create(
            wallet_address="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            display_name="Test Publisher",
        )
        self.assertEqual(pub.wallet_address, "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc")
        self.assertTrue(pub.is_active)

    def test_invalid_publisher_address_raises_error(self):
        pub = Publisher(wallet_address="invalid-address", display_name="Bad")
        with self.assertRaises(ValidationError):
            pub.full_clean()


class DomainModelTestCase(TestCase):
    def setUp(self):
        self.publisher = Publisher.objects.create(
            wallet_address="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
        )

    def test_domain_normalization(self):
        dom = Domain.objects.create(
            publisher=self.publisher,
            canonical_domain="  EXAMPLE.COM. ",
        )
        self.assertEqual(dom.canonical_domain, "example.com")
        self.assertEqual(dom.registration_status, DomainStatus.PENDING_DNS)

    def test_dns_challenge_expiry_properties(self):
        dom = Domain.objects.create(
            publisher=self.publisher,
            canonical_domain="test.org",
        )
        now = timezone.now()
        active_challenge = DNSChallenge.objects.create(
            domain=dom,
            challenge_value="token123",
            nonce="nonce123",
            record_name="_lucentra-verification.test.org",
            record_value="lucentra-verify=token123",
            expires_at=now + timedelta(minutes=15),
        )
        self.assertFalse(active_challenge.is_expired)
        self.assertFalse(active_challenge.is_consumed)
        self.assertTrue(active_challenge.is_valid_for_verification)

        expired_challenge = DNSChallenge.objects.create(
            domain=dom,
            challenge_value="tokenold",
            nonce="nonceold",
            record_name="_lucentra-verification.test.org",
            record_value="lucentra-verify=tokenold",
            expires_at=now - timedelta(minutes=1),
        )
        self.assertTrue(expired_challenge.is_expired)
        self.assertFalse(expired_challenge.is_valid_for_verification)


class ReleaseAndAttestationModelTestCase(TestCase):
    def setUp(self):
        self.pub = Publisher.objects.create(
            wallet_address="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
        )
        self.dom = Domain.objects.create(
            publisher=self.pub,
            canonical_domain="app.io",
            registration_status=DomainStatus.REGISTERED_ONCHAIN,
        )
        self.key = SigningKey.objects.create(
            domain=self.dom,
            public_address="0x90f79bf6eb2c4f870365e785982e1f101e93b906",
        )

    def test_create_release_and_attestation(self):
        rel = Release.objects.create(
            domain=self.dom,
            manifest_hash="0x" + "a" * 64,
            version="1.0.0",
            sequence=1,
            previous_manifest_hash="0x" + "0" * 64,
            signing_key=self.key,
            timestamp=1700000000,
            expires_at=1800000000,
            signature="0x" + "1" * 130,
            manifest_json={"manifestVersion": "0.1.0"},
            status=ReleaseStatus.ATTESTED,
        )
        self.assertEqual(rel.sequence, 1)

        att = Attestation.objects.create(
            release=rel,
            uid="0x" + "b" * 64,
            schema_uid="0x" + "c" * 64,
            attester_address="0x" + "d" * 40,
            transaction_hash="0x" + "e" * 64,
        )
        self.assertEqual(att.release, rel)
        self.assertFalse(att.revoked)
