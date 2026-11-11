import logging
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.domains.models import Domain, normalize_domain_name
from apps.attestations.models import Attestation
from apps.audit.service import record_audit_event
from blockchain.client import get_blockchain_client, BlockchainError
from .models import Release, SigningKey, ReleaseStatus
from .serializers import (
    ReleaseListSerializer,
    ReleaseDetailSerializer,
    SubmitReleaseSerializer,
    VerifyReleaseRequestSerializer,
)

logger = logging.getLogger(__name__)


class ReleaseViewSet(viewsets.ModelViewSet):
    """Viewset for submitting, verifying, and retrieving releases."""

    queryset = Release.objects.all().select_related("domain", "signing_key")
    lookup_field = "id"

    def get_serializer_class(self):
        if self.action == "list":
            return ReleaseListSerializer
        if self.action == "create":
            return SubmitReleaseSerializer
        return ReleaseDetailSerializer

    def create(self, request, *args, **kwargs):
        """Submit and attest a new signed release manifest."""
        req_serializer = SubmitReleaseSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)

        manifest = req_serializer.validated_data["manifest"]
        signature = req_serializer.validated_data["signature"]
        observed_resources = req_serializer.validated_data.get("observed_resources", {})

        domain_str = normalize_domain_name(manifest.get("domain", ""))
        domain = get_object_or_404(Domain, canonical_domain=domain_str)

        signing_key_raw = (
            req_serializer.validated_data.get("signing_key")
            or manifest.get("signingKey", "")
        )
        signing_key_addr = signing_key_raw.lower()
        signing_key = get_object_or_404(
            SigningKey,
            domain=domain,
            public_address=signing_key_addr,
            status="ACTIVE",
        )

        client = get_blockchain_client()

        # 1. Verify key authorization on-chain
        try:
            is_auth = client.is_key_authorized(domain_str, signing_key_addr)
            if not is_auth:
                return Response(
                    {
                        "error": {
                            "code": "unauthorized_signing_key",
                            "message": f"Signing key {signing_key_addr} is not authorized on-chain for {domain_str}.",
                        }
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except BlockchainError as e:
            logger.error("Failed to check on-chain key authorization: %s", e)
            return Response(
                {
                    "error": {
                        "code": "blockchain_error",
                        "message": f"On-chain key authorization check failed: {e}",
                    }
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # 2. Verify release structure and signature via @lucentra/core CLI
        try:
            verify_res = client.verify_release(
                manifest=manifest,
                observed_resources=observed_resources,
                signature=signature,
            )
        except BlockchainError as e:
            return Response(
                {
                    "error": {
                        "code": "verification_failed",
                        "message": f"Release verification failed: {e}",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        res_detail = verify_res.get("result", {})
        if not res_detail.get("isValid"):
            return Response(
                {
                    "error": {
                        "code": "invalid_release",
                        "message": "Release manifest verification returned invalid.",
                        "details": res_detail,
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        manifest_hash = res_detail.get("manifestHash")

        # 3. Submit attestation to EAS via ReleaseAttestationVerifier
        attestation_data = {
            "manifestHash": manifest_hash,
            "domain": domain_str,
            "version": str(manifest.get("version")),
            "sequence": int(manifest.get("sequence", 1)),
            "previousManifestHash": manifest.get(
                "previousManifestHash",
                "0x0000000000000000000000000000000000000000000000000000000000000000",
            ),
            "timestamp": int(manifest.get("createdAt", manifest.get("timestamp", 0))),
            "expiresAt": int(manifest.get("expiresAt", 0)),
            "signingKey": signing_key_addr,
            "signature": signature,
        }

        try:
            attest_res = client.attest_release(attestation_data)
        except BlockchainError as e:
            logger.error("Failed to attest release on-chain: %s", e)
            return Response(
                {
                    "error": {
                        "code": "attestation_failed",
                        "message": f"On-chain EAS attestation submission failed: {e}",
                    }
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        attestation_uid = attest_res.get("attestationUid")
        tx_hash = attest_res.get("transactionHash")

        # 4. Save Release and Attestation models
        release, created = Release.objects.update_or_create(
            domain=domain,
            sequence=int(manifest.get("sequence", 1)),
            defaults={
                "manifest_hash": manifest_hash,
                "version": str(manifest.get("version")),
                "previous_manifest_hash": attestation_data["previousManifestHash"],
                "signing_key": signing_key,
                "timestamp": attestation_data["timestamp"],
                "expires_at": attestation_data["expiresAt"],
                "signature": signature,
                "manifest_json": manifest,
                "attestation_uid": attestation_uid,
                "transaction_hash": tx_hash,
                "status": ReleaseStatus.ATTESTED,
            },
        )

        contracts = client.get_contract_addresses()
        release_verifier = contracts.get("ReleaseAttestationVerifier", "")

        if attestation_uid:
            Attestation.objects.update_or_create(
                uid=attestation_uid,
                defaults={
                    "release": release,
                    "schema_uid": client.get_schema_uid(),
                    "attester_address": release_verifier,
                    "transaction_hash": tx_hash or "",
                    "revoked": False,
                },
            )

        record_audit_event(
            action="RELEASE_ATTESTED",
            resource_type="Release",
            resource_id=str(release.id),
            actor=signing_key_addr,
            metadata={
                "domain": domain_str,
                "sequence": release.sequence,
                "version": release.version,
                "attestationUid": attestation_uid,
                "transactionHash": tx_hash,
            },
        )

        return Response(
            ReleaseDetailSerializer(release).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="verify")
    def verify_release(self, request):
        """Perform complete cryptographic and on-chain release verification."""
        req_serializer = VerifyReleaseRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)

        data = req_serializer.validated_data
        client = get_blockchain_client()

        try:
            res = client.verify_release(
                manifest=data["manifest"],
                observed_resources=data.get("observed_resources", {}),
                signature=data["signature"],
                attestation_uid=data.get("attestation_uid") or None,
                evaluation_time=data.get("evaluation_time"),
            )
            return Response(res.get("result", {}), status=status.HTTP_200_OK)
        except BlockchainError as e:
            return Response(
                {
                    "error": {
                        "code": "verification_error",
                        "message": str(e),
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
