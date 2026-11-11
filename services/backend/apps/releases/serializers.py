from rest_framework import serializers
from .models import SigningKey, Release
from apps.domains.models import Domain


class SigningKeySerializer(serializers.ModelSerializer):
    domain_name = serializers.CharField(source="domain.canonical_domain", read_only=True)

    class Meta:
        model = SigningKey
        fields = [
            "id",
            "domain_name",
            "public_address",
            "status",
            "authorized_at",
            "revoked_at",
        ]
        read_only_fields = fields


class ReleaseListSerializer(serializers.ModelSerializer):
    domain_name = serializers.CharField(source="domain.canonical_domain", read_only=True)
    signing_key_address = serializers.CharField(source="signing_key.public_address", read_only=True)

    class Meta:
        model = Release
        fields = [
            "id",
            "domain_name",
            "manifest_hash",
            "version",
            "sequence",
            "signing_key_address",
            "attestation_uid",
            "transaction_hash",
            "status",
            "created_at",
        ]


class ReleaseDetailSerializer(serializers.ModelSerializer):
    domain_name = serializers.CharField(source="domain.canonical_domain", read_only=True)
    signing_key_address = serializers.CharField(source="signing_key.public_address", read_only=True)

    class Meta:
        model = Release
        fields = [
            "id",
            "domain_name",
            "manifest_hash",
            "version",
            "sequence",
            "previous_manifest_hash",
            "signing_key_address",
            "timestamp",
            "expires_at",
            "signature",
            "manifest_json",
            "attestation_uid",
            "transaction_hash",
            "status",
            "created_at",
        ]


class SubmitReleaseSerializer(serializers.Serializer):
    manifest = serializers.JSONField()
    signature = serializers.CharField()
    signing_key = serializers.CharField(required=False, max_length=42)
    observed_resources = serializers.DictField(
        child=serializers.CharField(),
        required=False,
        default=dict,
    )

    def validate_manifest(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Manifest must be a JSON object.")
        required_fields = ["domain", "version", "resources"]
        for field in required_fields:
            if field not in value:
                raise serializers.ValidationError(f"Missing required manifest field: '{field}'")
        if "schemaVersion" not in value and "manifestVersion" not in value:
            raise serializers.ValidationError("Manifest must contain 'schemaVersion' or 'manifestVersion'.")
        if "createdAt" not in value and "timestamp" not in value:
            raise serializers.ValidationError("Manifest must contain 'createdAt' or 'timestamp'.")
        if "expiresAt" not in value:
            raise serializers.ValidationError("Manifest must contain 'expiresAt'.")
        return value

    def validate_signature(self, value):
        val = value.strip()
        if not val.startswith("0x") or len(val) != 132:
            raise serializers.ValidationError("Signature must be a 65-byte hex string (0x-prefixed, 132 characters).")
        return val


class VerifyReleaseRequestSerializer(serializers.Serializer):
    manifest = serializers.JSONField()
    signature = serializers.CharField()
    observed_resources = serializers.DictField(
        child=serializers.CharField(),
        required=False,
        default=dict,
    )
    attestation_uid = serializers.CharField(required=False, allow_blank=True)
    evaluation_time = serializers.IntegerField(required=False)
