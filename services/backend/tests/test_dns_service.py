from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from unittest.mock import MagicMock
import dns.resolver
import dns.exception
from apps.publishers.models import Publisher
from apps.domains.models import Domain, DNSChallenge, DomainStatus
from apps.domains.dns_service import (
    DNSService,
    DNSVerificationError,
    DNSChallengeExpiredError,
    DNSMaxAttemptsExceededError,
)


class MockTXTAnswer:
    def __init__(self, text: str):
        self.strings = [text.encode("utf-8")]

    def __str__(self):
        return f'"{self.strings[0].decode()}"'


class DNSServiceTestCase(TestCase):
    def setUp(self):
        self.pub = Publisher.objects.create(
            wallet_address="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
        )
        self.dom = Domain.objects.create(
            publisher=self.pub,
            canonical_domain="verified-site.com",
        )
        self.token = "abcdef1234567890abcdef1234567890"
        self.challenge = DNSChallenge.objects.create(
            domain=self.dom,
            challenge_value=self.token,
            nonce="nonce123",
            record_name=f"_lucentra-verification.{self.dom.canonical_domain}",
            record_value=f"lucentra-verify={self.token}",
            expires_at=timezone.now() + timedelta(minutes=15),
        )

    def test_record_formatting(self):
        service = DNSService()
        rec_name = service.format_record_name("Sub.Example.COM.")
        self.assertEqual(rec_name, "_lucentra-verification.sub.example.com")
        rec_val = service.format_record_value("xyz123")
        self.assertEqual(rec_val, "lucentra-verify=xyz123")

    def test_successful_dns_verification_with_mock_resolver(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve.return_value = [
            MockTXTAnswer("v=spf1 include:_spf.google.com ~all"),
            MockTXTAnswer(f"lucentra-verify={self.token}"),
        ]

        service = DNSService(resolver=mock_resolver)
        res = service.verify_challenge(self.challenge)

        self.assertTrue(res["verified"])
        self.assertIsNone(res["error"])

        self.challenge.refresh_from_db()
        self.assertIsNotNone(self.challenge.verified_at)
        self.assertEqual(self.challenge.attempts, 1)

        self.dom.refresh_from_db()
        self.assertEqual(self.dom.registration_status, DomainStatus.DNS_VERIFIED)
        self.assertIsNotNone(self.dom.last_verified_at)

    def test_missing_txt_record(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve.return_value = [
            MockTXTAnswer("some-other-record=val"),
        ]

        service = DNSService(resolver=mock_resolver)
        res = service.verify_challenge(self.challenge)

        self.assertFalse(res["verified"])
        self.assertIn("not found", res["error"])

        self.challenge.refresh_from_db()
        self.assertIsNone(self.challenge.verified_at)
        self.assertEqual(self.challenge.attempts, 1)

        self.dom.refresh_from_db()
        self.assertEqual(self.dom.registration_status, DomainStatus.PENDING_DNS)

    def test_nxdomain_handling(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve.side_effect = dns.resolver.NXDOMAIN

        service = DNSService(resolver=mock_resolver)
        res = service.verify_challenge(self.challenge)

        self.assertFalse(res["verified"])
        self.assertEqual(res["found_records"], [])

    def test_timeout_handling(self):
        mock_resolver = MagicMock()
        mock_resolver.resolve.side_effect = dns.resolver.Timeout

        service = DNSService(resolver=mock_resolver)
        res = service.verify_challenge(self.challenge)

        self.assertFalse(res["verified"])
        self.assertIn("timed out", res["error"])

    def test_expired_challenge_raises_error(self):
        self.challenge.expires_at = timezone.now() - timedelta(seconds=10)
        self.challenge.save()

        service = DNSService()
        with self.assertRaises(DNSChallengeExpiredError):
            service.verify_challenge(self.challenge)

    def test_max_attempts_exceeded_raises_error(self):
        self.challenge.attempts = 5
        self.challenge.save()

        service = DNSService()
        with self.assertRaises(DNSMaxAttemptsExceededError):
            service.verify_challenge(self.challenge)
