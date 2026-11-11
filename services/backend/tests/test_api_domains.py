from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch, MagicMock
from apps.publishers.models import Publisher
from apps.domains.models import Domain, DNSChallenge, DomainStatus
from apps.releases.models import SigningKey
from tests.test_dns_service import MockTXTAnswer


class DomainAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.publisher_wallet = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
        self.signing_key = "0x90f79bf6eb2c4f870365e785982e1f101e93b906"
        self.domain_name = "test-portal.org"

    def test_create_dns_challenge_endpoint(self):
        payload = {
            "domain": self.domain_name,
            "publisher": self.publisher_wallet,
        }
        response = self.client.post("/api/v1/domains/challenges/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()

        self.assertIn("challenge_value", data)
        self.assertEqual(data["record_name"], f"_lucentra-verification.{self.domain_name}")
        self.assertTrue(data["record_value"].startswith("lucentra-verify="))

        # Confirm publisher and domain created
        self.assertTrue(Publisher.objects.filter(wallet_address=self.publisher_wallet).exists())
        self.assertTrue(Domain.objects.filter(canonical_domain=self.domain_name).exists())

    @patch("apps.domains.views.get_dns_service")
    def test_verify_dns_endpoint_success(self, mock_get_dns):
        # Create domain and challenge
        pub = Publisher.objects.create(wallet_address=self.publisher_wallet)
        dom = Domain.objects.create(publisher=pub, canonical_domain=self.domain_name)
        chal = DNSChallenge.objects.create(
            domain=dom,
            challenge_value="chal123",
            nonce="nonce123",
            record_name=f"_lucentra-verification.{self.domain_name}",
            record_value="lucentra-verify=chal123",
            expires_at=timezone.now() + timedelta(minutes=15),
        )

        mock_dns = MagicMock()
        mock_dns.verify_challenge.return_value = {
            "verified": True,
            "record_name": chal.record_name,
            "expected_value": chal.record_value,
            "found_records": [chal.record_value],
            "error": None,
        }
        mock_get_dns.return_value = mock_dns

        payload = {"domain": self.domain_name, "challenge_id": chal.id}
        response = self.client.post("/api/v1/domains/verify-dns/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data["verified"])
        self.assertEqual(data["registration_status"], DomainStatus.PENDING_DNS)

    @patch("blockchain.client.BlockchainClient.register_domain")
    @patch("blockchain.client.BlockchainClient.verify_registration_auth")
    @patch("blockchain.client.BlockchainClient.get_nonce")
    def test_register_domain_with_auth_success(
        self, mock_nonce, mock_verify_auth, mock_reg
    ):
        pub = Publisher.objects.create(wallet_address=self.publisher_wallet)
        dom = Domain.objects.create(
            publisher=pub,
            canonical_domain=self.domain_name,
            registration_status=DomainStatus.DNS_VERIFIED,
        )
        chal = DNSChallenge.objects.create(
            domain=dom,
            challenge_value="chal123",
            nonce="nonce123",
            record_name=f"_lucentra-verification.{self.domain_name}",
            record_value="lucentra-verify=chal123",
            expires_at=timezone.now() + timedelta(minutes=15),
            verified_at=timezone.now(),
        )

        mock_nonce.return_value = 0
        mock_verify_auth.return_value = {"valid": True, "signer": self.publisher_wallet}
        mock_reg.return_value = {
            "success": True,
            "transactionHash": "0x" + "f" * 64,
        }

        fake_sig = "0x" + "1" * 130
        payload = {
            "domain": self.domain_name,
            "publisher": self.publisher_wallet,
            "initial_signing_key": self.signing_key,
            "deadline": 2000000000,
            "signature": fake_sig,
        }

        response = self.client.post("/api/v1/domains/register/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["status"], "REGISTERED_ONCHAIN")
        self.assertEqual(data["transaction_hash"], "0x" + "f" * 64)

        # Check DB updates
        dom.refresh_from_db()
        self.assertEqual(dom.registration_status, DomainStatus.REGISTERED_ONCHAIN)
        self.assertEqual(dom.onchain_registration_transaction, "0x" + "f" * 64)

        chal.refresh_from_db()
        self.assertIsNotNone(chal.consumed_at)

        self.assertTrue(
            SigningKey.objects.filter(
                domain=dom,
                public_address=self.signing_key,
                status="ACTIVE",
            ).exists()
        )

    def test_register_domain_rejected_without_verified_dns(self):
        pub = Publisher.objects.create(wallet_address=self.publisher_wallet)
        dom = Domain.objects.create(
            publisher=pub,
            canonical_domain=self.domain_name,
            registration_status=DomainStatus.PENDING_DNS,
        )
        fake_sig = "0x" + "1" * 130
        payload = {
            "domain": self.domain_name,
            "publisher": self.publisher_wallet,
            "initial_signing_key": self.signing_key,
            "deadline": 2000000000,
            "signature": fake_sig,
        }
        response = self.client.post("/api/v1/domains/register/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertEqual(data["error"]["code"], "dns_not_verified")
