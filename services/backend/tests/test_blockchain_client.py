from django.test import TestCase
from unittest.mock import patch
from blockchain.client import (
    BlockchainClient,
    BlockchainConnectionError,
    BlockchainExecutionError,
)


class BlockchainClientTestCase(TestCase):
    def setUp(self):
        self.client = BlockchainClient()

    def test_get_deployment_config_reads_json(self):
        config = self.client.get_deployment_config()
        self.assertIn("chainId", config)
        self.assertIn("contracts", config)
        self.assertIn("schema", config)

    def test_get_contract_addresses(self):
        contracts = self.client.get_contract_addresses()
        self.assertIn("PublisherRegistry", contracts)
        self.assertIn("SignatureVerifier", contracts)
        self.assertIn("ReleaseAttestationVerifier", contracts)
        self.assertIn("EAS", contracts)
        self.assertIn("SchemaRegistry", contracts)

    def test_get_schema_uid(self):
        uid = self.client.get_schema_uid()
        self.assertTrue(uid.startswith("0x"))
        self.assertEqual(len(uid), 66)

    @patch("subprocess.run")
    def test_run_cli_command_success(self, mock_run):
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = '{"success": true, "nonce": 42}'
        mock_run.return_value.stderr = ""

        res = self.client._run_cli_command("get-nonce", {"publisher": "0x123"})
        self.assertTrue(res["success"])
        self.assertEqual(res["nonce"], 42)

    @patch("subprocess.run")
    def test_run_cli_command_execution_error(self, mock_run):
        mock_run.return_value.returncode = 1
        mock_run.return_value.stdout = '{"success": false, "error": "Reverted with InvalidSignature"}'
        mock_run.return_value.stderr = ""

        with self.assertRaises(BlockchainExecutionError):
            self.client._run_cli_command("register-domain", {})
