import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Publisher
from .serializers import PublisherSerializer
from blockchain.client import get_blockchain_client, BlockchainError

logger = logging.getLogger(__name__)


class PublisherViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for inspecting publishers and querying on-chain nonces.

    Mutations (POST, PUT, PATCH, DELETE) are disallowed. Publishers are created
    and authorized strictly through the cryptographic domain registration flow.
    """

    queryset = Publisher.objects.all()
    serializer_class = PublisherSerializer
    lookup_field = "wallet_address"

    def get_object(self):
        # Normalize lookup address to lowercase
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        self.kwargs[lookup_url_kwarg] = self.kwargs[lookup_url_kwarg].lower()
        return super().get_object()

    @action(detail=True, methods=["get"], url_path="nonce")
    def get_nonce(self, request, wallet_address=None):
        """Query current on-chain registration nonce from PublisherRegistry."""
        publisher_address = wallet_address.lower()
        client = get_blockchain_client()
        try:
            nonce = client.get_nonce(publisher_address)
            return Response(
                {
                    "publisher": publisher_address,
                    "nonce": nonce,
                }
            )
        except BlockchainError as e:
            logger.error("Failed to query nonce for %s: %s", publisher_address, e)
            return Response(
                {
                    "error": {
                        "code": "blockchain_error",
                        "message": f"Failed to retrieve on-chain nonce: {str(e)}",
                    }
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
