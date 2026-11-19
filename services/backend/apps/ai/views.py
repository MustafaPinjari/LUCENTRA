"""API Views for LUCENTRA AI Explanation Service.

Provides:
- POST /api/v1/ai/explanations/ (General evidence explanation)
- GET /api/v1/domains/{domain}/explain/ (Authoritative domain state explanation)
"""

import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from apps.domains.models import Domain, normalize_domain_name
from apps.releases.models import Release, ReleaseStatus
from .serializers import (
    ExplanationRequestSerializer,
    SecurityExplanationResponseSerializer,
)
from .services import get_gemini_service, sanitize_evidence
from .schemas import ProtocolVerificationState

logger = logging.getLogger(__name__)


class AIExplanationRateThrottle(AnonRateThrottle):
    rate = "30/minute"


class ExplanationView(APIView):
    """Explains cryptographic verification evidence using Google Gemini AI or deterministic fallback.

    Accepts structured verification evidence, sanitizes input, applies prompt-injection defenses,
    and returns a structured security explanation.
    """

    throttle_classes = [AIExplanationRateThrottle]

    def post(self, request):
        serializer = ExplanationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        force_refresh = data.pop("force_refresh", False)

        domain_str = data.get("domain", "")
        # Enrich with backend authoritative state if domain exists in database
        try:
            domain_norm = normalize_domain_name(domain_str)
            domain_obj = Domain.objects.filter(canonical_domain=domain_norm).select_related("publisher").first()
            if domain_obj:
                data["publisher_registered"] = (domain_obj.registration_status == "REGISTERED_ONCHAIN")
                data["publisher_address"] = domain_obj.publisher.wallet_address

                latest_release = domain_obj.releases.order_by("-sequence").first()
                if latest_release:
                    data.setdefault("release_version", latest_release.version)
                    data.setdefault("sequence", latest_release.sequence)
                    data.setdefault("manifest_digest", latest_release.manifest_hash)
                    data.setdefault("attestation_uid", latest_release.attestation_uid)
                    data.setdefault("is_attested", latest_release.status == ReleaseStatus.ATTESTED)
                    data.setdefault("is_revoked", latest_release.status == ReleaseStatus.REVOKED)
        except Exception as e:
            logger.debug("Backend domain enrichment skipped for %s: %s", domain_str, e)

        # Sanitize input against prompt injection and payload bloating
        evidence = sanitize_evidence(data)

        # Generate explanation via Gemini service (or graceful fallback)
        service = get_gemini_service()
        explanation = service.generate_explanation(evidence, force_refresh=force_refresh)

        resp_serializer = SecurityExplanationResponseSerializer(explanation.model_dump(mode="json"))
        return Response(resp_serializer.data, status=status.HTTP_200_OK)


class DomainExplanationView(APIView):
    """Convenience endpoint explaining current verified backend state of a domain."""

    throttle_classes = [AIExplanationRateThrottle]

    def get(self, request, domain=None):
        clean_domain = normalize_domain_name(domain)
        try:
            domain_obj = Domain.objects.select_related("publisher").get(canonical_domain=clean_domain)
        except Domain.DoesNotExist:
            # Domain not registered in backend
            payload = {
                "domain": clean_domain,
                "verification_state": ProtocolVerificationState.UNREGISTERED_PUBLISHER.value,
                "publisher_registered": False,
                "observation_completeness": "COMPLETE",
            }
            evidence = sanitize_evidence(payload)
            service = get_gemini_service()
            explanation = service.generate_explanation(evidence)
            return Response(explanation.model_dump(mode="json"), status=status.HTTP_200_OK)

        latest_release = domain_obj.releases.order_by("-sequence").first()
        if latest_release:
            if latest_release.status == ReleaseStatus.REVOKED:
                state = ProtocolVerificationState.REVOKED_RELEASE.value
            elif latest_release.status == ReleaseStatus.ATTESTED:
                state = ProtocolVerificationState.VERIFIED_RELEASE_MATCH.value
            else:
                state = ProtocolVerificationState.UNATTESTED_RELEASE.value
            release_version = latest_release.version
            sequence = latest_release.sequence
            digest = latest_release.manifest_hash
            attestation_uid = latest_release.attestation_uid
            is_attested = (latest_release.status == ReleaseStatus.ATTESTED)
            is_revoked = (latest_release.status == ReleaseStatus.REVOKED)
        else:
            state = ProtocolVerificationState.INDETERMINATE.value
            release_version = None
            sequence = None
            digest = None
            attestation_uid = None
            is_attested = False
            is_revoked = False

        payload = {
            "domain": clean_domain,
            "verification_state": state,
            "publisher_registered": (domain_obj.registration_status == "REGISTERED_ONCHAIN"),
            "publisher_address": domain_obj.publisher.wallet_address,
            "release_version": release_version,
            "sequence": sequence,
            "manifest_digest": digest,
            "attestation_uid": attestation_uid,
            "is_attested": is_attested,
            "is_revoked": is_revoked,
            "observation_completeness": "COMPLETE",
        }

        evidence = sanitize_evidence(payload)
        service = get_gemini_service()
        explanation = service.generate_explanation(evidence)
        return Response(explanation.model_dump(mode="json"), status=status.HTTP_200_OK)
