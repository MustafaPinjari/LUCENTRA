"""Health and Readiness endpoints for LUCENTRA backend."""

import logging
from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from blockchain.client import get_blockchain_client, BlockchainError

logger = logging.getLogger(__name__)


class HealthView(APIView):
    """Liveness probe: verifies basic service execution and SQLite connectivity."""

    def get(self, request):
        db_status = "connected"
        try:
            connection.ensure_connection()
        except Exception as e:
            logger.error("Database health check failed: %s", e)
            db_status = f"disconnected: {e}"
            return Response(
                {
                    "status": "unhealthy",
                    "version": "0.1.0",
                    "database": db_status,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "status": "ok",
                "version": "0.1.0",
                "database": db_status,
            },
            status=status.HTTP_200_OK,
        )


class ReadinessView(APIView):
    """Readiness probe: verifies database and on-chain Anvil deployment contracts."""

    def get(self, request):
        db_connected = False
        try:
            connection.ensure_connection()
            db_connected = True
        except Exception as e:
            logger.error("Readiness check: database failure: %s", e)

        blockchain_status = {
            "rpcConnected": False,
            "chainId": 0,
            "contractsReady": False,
            "schemaReady": False,
        }

        try:
            client = get_blockchain_client()
            blockchain_status = client.check_readiness()
        except Exception as e:
            logger.warning("Readiness check: blockchain client failure: %s", e)
            blockchain_status["error"] = str(e)

        is_ready = (
            db_connected
            and blockchain_status.get("rpcConnected", False)
            and blockchain_status.get("contractsReady", False)
            and blockchain_status.get("schemaReady", False)
        )

        resp_data = {
            "status": "ready" if is_ready else "not_ready",
            "database": "connected" if db_connected else "disconnected",
            "blockchain": blockchain_status,
        }

        return Response(
            resp_data,
            status=status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE,
        )
