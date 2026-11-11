import logging
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.response import Response
from blockchain.client import get_blockchain_client, BlockchainError
from .models import Attestation
from .serializers import AttestationSerializer

logger = logging.getLogger(__name__)


class AttestationViewSet(viewsets.ReadOnlyModelViewSet):
    """Viewset for querying indexed EAS attestations."""

    queryset = Attestation.objects.all().select_related("release", "release__domain")
    serializer_class = AttestationSerializer
    lookup_field = "uid"

    def retrieve(self, request, *args, **kwargs):
        """Retrieve attestation record and optionally verify live on-chain status."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = dict(serializer.data)

        # Cross-check live on-chain state if requested
        if request.query_params.get("live", "false").lower() == "true":
            client = get_blockchain_client()
            try:
                onchain_data = client.query_attestation(instance.uid)
                data["live_onchain"] = onchain_data
            except BlockchainError as e:
                data["live_onchain_error"] = str(e)

        return Response(data)
