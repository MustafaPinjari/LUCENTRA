from rest_framework import serializers
from .models import Publisher, ETH_ADDRESS_REGEX


class PublisherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Publisher
        fields = [
            "id",
            "wallet_address",
            "display_name",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_wallet_address(self, value):
        if not ETH_ADDRESS_REGEX.match(value):
            raise serializers.ValidationError("Invalid EVM wallet address format.")
        return value.lower()
