from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch
from apps.publishers.models import Publisher
from apps.domains.models import Domain, DomainStatus
from apps.releases.models import SigningKey, Release
from apps.attestations.models import Attestation


class ReleaseAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.publisher_wallet = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
        self.signing_key = "0x90f79bf6eb2c4f870365e785982e1f101e93b906"
        self.domain_name = "release-portal.com"

        self.pub = Publisher.objects.create(wallet_address=self.publisher_wallet)
        self.dom = Domain.objects.create(
            publisher=self.pub,
            canonical_domain=self.domain_name,
            registration_status=DomainStatus.REGISTERED_ONCHAIN,
        )
        self.key = SigningKey.objects.create(
            domain=self.dom,
            public_address=self.signing_key,
            status="ACTIVE",
        )

        self.sample_manifest = {
            "manifestVersion": "0.1.0",
            "domain": self.domain_name,
            "version": "1.0.0",
            "sequence": 1,
            "previousManifestHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "timestamp": 1700000000,
            "expiresAt": 1800000000,
            "signingKey": self.signing_key,
            "resources": [
                {
                    "path": "/app.js",
                    "hash": "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=",
                }
            ],
        }
        self.sample_signature = "0x" + "2" * 130

    @patch("blockchain.client.BlockchainClient.attest_release")
    @patch("blockchain.client.BlockchainClient.verify_release")
    @patch("blockchain.client.BlockchainClient.is_key_authorized")
    def test_submit_release_success(self, mock_is_auth, mock_verify, mock_attest):
        mock_is_auth.return_value = True
        mock_verify.return_value = {
            "result": {
                "isValid": True,
                "manifestHash": "0x" + "a" * 64,
                "domain": self.domain_name,
                "sequence": 1,
                "signingKey": self.signing_key,
            }
        }
        mock_attest.return_value = {
            "success": True,
            "attestationUid": "0x" + "b" * 64,
            "transactionHash": "0x" + "c" * 64,
        }

        payload = {
            "manifest": self.sample_manifest,
            "signature": self.sample_signature,
            "observed_resources": {
                "/app.js": "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="
            },
        }

        response = self.client.post("/api/v1/releases/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()

        self.assertEqual(data["version"], "1.0.0")
        self.assertEqual(data["sequence"], 1)
        self.assertEqual(data["attestation_uid"], "0x" + "b" * 64)

        # Confirm DB creation
        self.assertTrue(Release.objects.filter(domain=self.dom, sequence=1).exists())
        self.assertTrue(Attestation.objects.filter(uid="0x" + "b" * 64).exists())

    @patch("blockchain.client.BlockchainClient.is_key_authorized")
    def test_submit_release_unauthorized_key_rejected(self, mock_is_auth):
        mock_is_auth.return_value = False
        payload = {
            "manifest": self.sample_manifest,
            "signature": self.sample_signature,
        }
        response = self.client.post("/api/v1/releases/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertEqual(data["error"]["code"], "unauthorized_signing_key")

    @patch("blockchain.client.BlockchainClient.verify_release")
    def test_verify_release_action(self, mock_verify):
        mock_verify.return_value = {
            "result": {
                "isValid": True,
                "manifestHash": "0x" + "a" * 64,
                "manifestVerification": {"valid": True},
                "signatureVerification": {"valid": True},
                "resourceIntegrity": {"allMatch": True},
            }
        }
        payload = {
            "manifest": self.sample_manifest,
            "signature": self.sample_signature,
        }
        response = self.client.post("/api/v1/releases/verify/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data["isValid"])
