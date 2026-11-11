from rest_framework import serializers
from apps.publishers.models import ETH_ADDRESS_REGEX
from .models import Domain, DNSChallenge, normalize_domain_name, DOMAIN_REGEX


class DNSChallengeSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)
    is_consumed = serializers.BooleanField(read_only=True)

    class Meta:
        model = DNSChallenge
        fields = [
            "id",
            "domain_id",
            "challenge_value",
            "record_name",
            "record_value",
            "expires_at",
            "attempts",
            "verified_at",
            "consumed_at",
            "is_expired",
            "is_consumed",
            "created_at",
        ]
        read_only_fields = fields


class CreateDNSChallengeRequestSerializer(serializers.Serializer):
    domain = serializers.CharField(max_length=255)
    publisher = serializers.CharField(max_length=42)

    def validate_domain(self, value):
        normalized = normalize_domain_name(value)
        if not DOMAIN_REGEX.match(normalized):
            raise serializers.ValidationError("Invalid domain name format.")
        return normalized

    def validate_publisher(self, value):
        if not ETH_ADDRESS_REGEX.match(value):
            raise serializers.ValidationError("Invalid publisher EVM wallet address format.")
        return value.lower()


class VerifyDNSRequestSerializer(serializers.Serializer):
    domain = serializers.CharField(max_length=255)
    challenge_id = serializers.IntegerField(required=False)

    def validate_domain(self, value):
        return normalize_domain_name(value)


class RegisterDomainRequestSerializer(serializers.Serializer):
    domain = serializers.CharField(max_length=255)
    publisher = serializers.CharField(max_length=42)
    initial_signing_key = serializers.CharField(max_length=42)
    deadline = serializers.IntegerField()
    signature = serializers.CharField()

    def validate_domain(self, value):
        normalized = normalize_domain_name(value)
        if not DOMAIN_REGEX.match(normalized):
            raise serializers.ValidationError("Invalid domain format.")
        return normalized

    def validate_publisher(self, value):
        if not ETH_ADDRESS_REGEX.match(value):
            raise serializers.ValidationError("Invalid publisher wallet address format.")
        return value.lower()

    def validate_initial_signing_key(self, value):
        if not ETH_ADDRESS_REGEX.match(value):
            raise serializers.ValidationError("Invalid initial signing key EVM address format.")
        return value.lower()

    def validate_signature(self, value):
        val = value.strip()
        if not val.startswith("0x") or len(val) != 132:
            raise serializers.ValidationError("Signature must be a 65-byte hex string (0x-prefixed, 132 characters).")
        return val


class DomainListSerializer(serializers.ModelSerializer):
    publisher_wallet = serializers.CharField(source="publisher.wallet_address", read_only=True)

    class Meta:
        model = Domain
        fields = [
            "id",
            "canonical_domain",
            "publisher_wallet",
            "registration_status",
            "chain_id",
            "onchain_registration_transaction",
            "registered_at",
            "last_verified_at",
            "created_at",
        ]


class DomainDetailSerializer(serializers.ModelSerializer):
    publisher_wallet = serializers.CharField(source="publisher.wallet_address", read_only=True)
    active_challenges = serializers.SerializerMethodField()
    signing_keys_count = serializers.SerializerMethodField()
    releases_count = serializers.SerializerMethodField()

    class Meta:
        model = Domain
        fields = [
            "id",
            "canonical_domain",
            "publisher_wallet",
            "registration_status",
            "chain_id",
            "onchain_registration_transaction",
            "registered_at",
            "last_verified_at",
            "signing_keys_count",
            "releases_count",
            "active_challenges",
            "created_at",
            "updated_at",
        ]

    def get_active_challenges(self, obj):
        challenges = obj.dns_challenges.filter(consumed_at__isnull=True).order_by("-created_at")[:1]
        return DNSChallengeSerializer(challenges, many=True).data

    def get_signing_keys_count(self, obj):
        return obj.signing_keys.count()

    def get_releases_count(self, obj):
        return obj.releases.count()
