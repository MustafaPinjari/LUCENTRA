"""DRF Serializers for LUCENTRA AI Explanation API."""

from rest_framework import serializers


class ResourceDiscrepancySerializer(serializers.Serializer):
    path = serializers.CharField(max_length=512)
    status = serializers.ChoiceField(
        choices=["MATCH", "MISMATCH", "MISSING_ON_SERVER", "UNEXPECTED_RESOURCE", "FAILED_FETCH"]
    )
    expected_hash = serializers.CharField(max_length=128, required=False, allow_null=True)
    observed_hash = serializers.CharField(max_length=128, required=False, allow_null=True)


class ExplanationRequestSerializer(serializers.Serializer):
    domain = serializers.CharField(max_length=253)
    verification_state = serializers.ChoiceField(
        choices=[
            "VERIFIED_RELEASE_MATCH",
            "UNVERIFIED_RESOURCE_DETECTED",
            "UNREGISTERED_PUBLISHER",
            "REVOKED_RELEASE",
            "UNATTESTED_RELEASE",
            "INDETERMINATE",
        ],
        required=False,
        default="INDETERMINATE",
    )
    publisher_registered = serializers.BooleanField(required=False, default=False)
    publisher_address = serializers.CharField(max_length=42, required=False, allow_blank=True, allow_null=True)
    release_version = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    sequence = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    manifest_digest = serializers.CharField(max_length=66, required=False, allow_blank=True, allow_null=True)
    attestation_uid = serializers.CharField(max_length=66, required=False, allow_blank=True, allow_null=True)
    is_attested = serializers.BooleanField(required=False, default=False)
    is_revoked = serializers.BooleanField(required=False, default=False)
    resource_discrepancies = ResourceDiscrepancySerializer(many=True, required=False, default=list)
    inline_script_count = serializers.IntegerField(required=False, default=0, min_value=0)
    has_inline_scripts = serializers.BooleanField(required=False, default=False)
    observation_completeness = serializers.ChoiceField(
        choices=["COMPLETE", "INCOMPLETE"],
        required=False,
        default="COMPLETE",
    )
    evaluation_timestamp = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    force_refresh = serializers.BooleanField(required=False, default=False)


class SecurityExplanationResponseSerializer(serializers.Serializer):
    headline = serializers.CharField()
    risk_level = serializers.CharField()
    detailed_explanation = serializers.CharField()
    technical_discrepancy_summary = serializers.CharField()
    recommended_action = serializers.CharField()
    evidence_references = serializers.ListField(child=serializers.CharField())
    limitations = serializers.CharField()
    model_id = serializers.CharField()
    generated_at = serializers.CharField()
    deterministic_state = serializers.CharField()

