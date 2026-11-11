from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch


class HealthAndReadinessAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_check_returns_200(self):
        response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["database"], "connected")
        self.assertEqual(data["version"], "0.1.0")

    @patch("blockchain.client.BlockchainClient.check_readiness")
    def test_readiness_check_success(self, mock_check):
        mock_check.return_value = {
            "rpcConnected": True,
            "chainId": 31337,
            "contractsReady": True,
            "schemaReady": True,
        }
        response = self.client.get("/api/v1/readiness/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], "ready")
        self.assertEqual(data["database"], "connected")
        self.assertTrue(data["blockchain"]["rpcConnected"])
        self.assertTrue(data["blockchain"]["contractsReady"])
        self.assertTrue(data["blockchain"]["schemaReady"])

    @patch("blockchain.client.BlockchainClient.check_readiness")
    def test_readiness_check_failure_returns_503(self, mock_check):
        mock_check.return_value = {
            "rpcConnected": False,
            "chainId": 0,
            "contractsReady": False,
            "schemaReady": False,
        }
        response = self.client.get("/api/v1/readiness/")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        data = response.json()
        self.assertEqual(data["status"], "not_ready")
        self.assertFalse(data["blockchain"]["rpcConnected"])
