from rest_framework import serializers
from .models import Attestation


class AttestationSerializer(serializers.ModelSerializer):
    domain = serializers.CharField(source="release.domain.canonical_domain", read_only=True)
    sequence = serializers.IntegerField(source="release.sequence", read_only=True)
    manifest_hash = serializers.CharField(source="release.manifest_hash", read_only=True)

    class Meta:
        model = Attestation
        fields = [
            "id",
            "uid",
            "schema_uid",
            "domain",
            "sequence",
            "manifest_hash",
            "attester_address",
            "transaction_hash",
            "revoked",
            "revocation_time",
            "indexed_at",
        ]
        read_only_fields = fields
