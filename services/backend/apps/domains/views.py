import logging
from datetime import timedelta
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.publishers.models import Publisher
from apps.releases.models import SigningKey, Release
from apps.releases.serializers import SigningKeySerializer, ReleaseListSerializer
from apps.audit.service import record_audit_event
from blockchain.client import get_blockchain_client, BlockchainError
from .models import Domain, DNSChallenge, DomainStatus, normalize_domain_name
from .serializers import (
    DomainListSerializer,
    DomainDetailSerializer,
    DNSChallengeSerializer,
    CreateDNSChallengeRequestSerializer,
    VerifyDNSRequestSerializer,
    RegisterDomainRequestSerializer,
)
from .dns_service import (
    get_dns_service,
    DNSVerificationError,
    DNSChallengeExpiredError,
    DNSMaxAttemptsExceededError,
)

logger = logging.getLogger(__name__)


class DomainViewSet(viewsets.ModelViewSet):
    """Viewset for domain management, DNS challenges, and blockchain registration."""

    queryset = Domain.objects.all().select_related("publisher")
    lookup_field = "canonical_domain"

    def get_serializer_class(self):
        if self.action == "list":
            return DomainListSerializer
        return DomainDetailSerializer

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field)
        if lookup.isdigit():
            return get_object_or_404(Domain, id=int(lookup))
        normalized = normalize_domain_name(lookup)
        return get_object_or_404(Domain, canonical_domain=normalized)

    @action(detail=False, methods=["post"], url_path="challenges")
    def create_challenge(self, request):
        """Initiate domain verification by generating a DNS TXT challenge."""
        req_serializer = CreateDNSChallengeRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)

        domain_str = req_serializer.validated_data["domain"]
        publisher_wallet = req_serializer.validated_data["publisher"]

        # Ensure publisher exists
        publisher, _ = Publisher.objects.get_or_create(
            wallet_address=publisher_wallet,
            defaults={"display_name": domain_str},
        )

        domain, _ = Domain.objects.get_or_create(
            canonical_domain=domain_str,
            defaults={
                "publisher": publisher,
                "registration_status": DomainStatus.PENDING_DNS,
            },
        )

        if domain.publisher != publisher and domain.registration_status == DomainStatus.REGISTERED_ONCHAIN:
            return Response(
                {
                    "error": {
                        "code": "domain_already_registered",
                        "message": f"Domain {domain_str} is already registered to another publisher.",
                    }
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Generate challenge token and record details
        dns_service = get_dns_service()
        challenge_token = dns_service.generate_challenge_token()
        nonce = dns_service.generate_challenge_token()[:16]
        record_name = dns_service.format_record_name(domain_str)
        record_value = dns_service.format_record_value(challenge_token)
        ttl_seconds = getattr(request._request, "challenge_ttl", 900)
        expires_at = timezone.now() + timedelta(seconds=ttl_seconds)

        challenge = DNSChallenge.objects.create(
            domain=domain,
            challenge_value=challenge_token,
            nonce=nonce,
            record_name=record_name,
            record_value=record_value,
            expires_at=expires_at,
        )

        record_audit_event(
            action="DNS_CHALLENGE_CREATED",
            resource_type="DNSChallenge",
            resource_id=str(challenge.id),
            actor=publisher_wallet,
            metadata={
                "domain": domain_str,
                "record_name": record_name,
                "expires_at": expires_at.isoformat(),
            },
        )

        return Response(DNSChallengeSerializer(challenge).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="verify-dns")
    def verify_dns(self, request):
        """Execute real DNS TXT resolution to verify domain ownership."""
        req_serializer = VerifyDNSRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)

        domain_str = req_serializer.validated_data["domain"]
        challenge_id = req_serializer.validated_data.get("challenge_id")

        domain = get_object_or_404(Domain, canonical_domain=domain_str)

        if challenge_id:
            challenge = get_object_or_404(DNSChallenge, id=challenge_id, domain=domain)
        else:
            challenge = (
                domain.dns_challenges.filter(consumed_at__isnull=True)
                .order_by("-created_at")
                .first()
            )
            if not challenge:
                return Response(
                    {
                        "error": {
                            "code": "challenge_not_found",
                            "message": f"No active DNS challenge found for domain {domain_str}.",
                        }
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

        dns_service = get_dns_service()
        try:
            result = dns_service.verify_challenge(challenge)
        except (DNSChallengeExpiredError, DNSMaxAttemptsExceededError) as e:
            return Response(
                {
                    "error": {
                        "code": "challenge_invalid",
                        "message": str(e),
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if result.get("verified"):
            record_audit_event(
                action="DNS_VERIFIED",
                resource_type="Domain",
                resource_id=domain_str,
                actor=domain.publisher.wallet_address,
                metadata={
                    "challenge_id": challenge.id,
                    "record_name": result.get("record_name"),
                },
            )

        return Response(
            {
                "domain": domain_str,
                "verified": result.get("verified", False),
                "record_name": result.get("record_name"),
                "expected_value": result.get("expected_value"),
                "found_records": result.get("found_records", []),
                "error": result.get("error"),
                "registration_status": domain.registration_status,
            },
            status=status.HTTP_200_OK if result.get("verified") else status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    @action(detail=False, methods=["post"], url_path="register")
    def register_domain(self, request):
        """Submit on-chain domain registration with dual-authorization verification."""
        req_serializer = RegisterDomainRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)

        data = req_serializer.validated_data
        domain_str = data["domain"]
        publisher_wallet = data["publisher"]
        initial_signing_key = data["initial_signing_key"]
        deadline = data["deadline"]
        signature = data["signature"]

        domain = get_object_or_404(Domain, canonical_domain=domain_str)

        # 1. Verify that domain has a verified, unconsumed DNS challenge
        active_challenge = (
            domain.dns_challenges.filter(
                verified_at__isnull=False,
                consumed_at__isnull=True,
            )
            .order_by("-verified_at")
            .first()
        )

        if not active_challenge:
            return Response(
                {
                    "error": {
                        "code": "dns_not_verified",
                        "message": "Domain does not have a verified, unconsumed DNS challenge.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if active_challenge.is_expired:
            return Response(
                {
                    "error": {
                        "code": "challenge_expired",
                        "message": "The verified DNS challenge has expired. Please verify DNS again.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Check current on-chain nonce for publisher
        client = get_blockchain_client()
        try:
            onchain_nonce = client.get_nonce(publisher_wallet)
        except BlockchainError as e:
            logger.error("Failed to fetch on-chain nonce: %s", e)
            return Response(
                {
                    "error": {
                        "code": "blockchain_error",
                        "message": f"Failed to retrieve on-chain registration nonce: {e}",
                    }
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # 3. Verify EIP-712 signature intent locally via @lucentra/core CLI
        try:
            auth_result = client.verify_registration_auth(
                domain=domain_str,
                publisher=publisher_wallet,
                initial_signing_key=initial_signing_key,
                nonce=onchain_nonce,
                deadline=deadline,
                signature=signature,
            )
        except BlockchainError as e:
            return Response(
                {
                    "error": {
                        "code": "invalid_signature",
                        "message": f"Registration authorization verification failed: {e}",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_valid_auth = bool(auth_result.get("isValid", auth_result.get("valid", False)))
        if not is_valid_auth:
            return Response(
                {
                    "error": {
                        "code": "invalid_signature",
                        "message": "EIP-712 registration authorization signature is invalid.",
                        "details": auth_result,
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 4. Submit on-chain registration transaction via registrar
        try:
            reg_result = client.register_domain(
                domain=domain_str,
                publisher=publisher_wallet,
                initial_signing_key=initial_signing_key,
                deadline=deadline,
                signature=signature,
            )
        except BlockchainError as e:
            logger.error("On-chain registration failed: %s", e)
            return Response(
                {
                    "error": {
                        "code": "onchain_registration_failed",
                        "message": f"Blockchain transaction reverted: {e}",
                    }
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        tx_hash = reg_result.get("transactionHash", "")
        now = timezone.now()

        # 5. Mark challenge as consumed
        active_challenge.consumed_at = now
        active_challenge.save(update_fields=["consumed_at"])

        # 6. Update Domain status and record SigningKey
        domain.registration_status = DomainStatus.REGISTERED_ONCHAIN
        domain.onchain_registration_transaction = tx_hash
        domain.registered_at = now
        domain.save(
            update_fields=[
                "registration_status",
                "onchain_registration_transaction",
                "registered_at",
            ]
        )

        SigningKey.objects.get_or_create(
            domain=domain,
            public_address=initial_signing_key.lower(),
            defaults={"status": "ACTIVE"},
        )

        record_audit_event(
            action="DOMAIN_REGISTERED_ONCHAIN",
            resource_type="Domain",
            resource_id=domain_str,
            actor=publisher_wallet,
            metadata={
                "transactionHash": tx_hash,
                "initialSigningKey": initial_signing_key,
                "deadline": deadline,
            },
        )

        return Response(
            {
                "domain": domain_str,
                "status": "REGISTERED_ONCHAIN",
                "transaction_hash": tx_hash,
                "registered_at": now.isoformat(),
                "initial_signing_key": initial_signing_key,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="keys")
    def list_keys(self, request, canonical_domain=None):
        """List operational release-signing keys authorized for this domain."""
        domain = self.get_object()
        keys = domain.signing_keys.all()
        return Response(SigningKeySerializer(keys, many=True).data)

    @action(detail=True, methods=["get"], url_path="releases")
    def list_releases(self, request, canonical_domain=None):
        """List releases registered for this domain."""
        domain = self.get_object()
        releases = domain.releases.all().order_by("-sequence")
        return Response(ReleaseListSerializer(releases, many=True).data)

    @action(detail=True, methods=["get"], url_path="verification-status")
    def verification_status(self, request, canonical_domain=None):
        """Return cryptographic and on-chain verification status for client extensions."""
        domain = self.get_object()
        client = get_blockchain_client()

        onchain_info = {}
        latest_release_info = {}

        try:
            onchain_info = client.query_publisher(domain.canonical_domain)
        except Exception as e:
            logger.warning("Could not query on-chain publisher info for %s: %s", domain.canonical_domain, e)

        try:
            latest_release_info = client.query_latest_release(domain.canonical_domain)
        except Exception as e:
            logger.warning("Could not query latest release for %s: %s", domain.canonical_domain, e)

        return Response(
            {
                "domain": domain.canonical_domain,
                "registration_status": domain.registration_status,
                "publisher_wallet": domain.publisher.wallet_address,
                "chain_id": domain.chain_id,
                "onchain_registration_transaction": domain.onchain_registration_transaction,
                "onchain_info": onchain_info,
                "latest_release": latest_release_info,
                "last_verified_at": domain.last_verified_at,
            }
        )
