from django.db import models
from django.core.exceptions import ValidationError
import re

ETH_ADDRESS_REGEX = re.compile(r"^0x[a-fA-F0-9]{40}$")


def validate_eth_address(value: str):
    if not isinstance(value, str) or not ETH_ADDRESS_REGEX.match(value):
        raise ValidationError(f"'{value}' is not a valid EVM address.")


class Publisher(models.Model):
    """Represents a registered website publisher identified by their EVM wallet address."""

    wallet_address = models.CharField(
        max_length=42,
        unique=True,
        db_index=True,
        validators=[validate_eth_address],
        help_text="Checksummed or lowercase 0x-prefixed EVM address",
    )
    display_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Optional human-readable organization or entity name",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Designates whether this publisher is active or administratively suspended",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "publishers"
        ordering = ["-created_at"]

    def clean(self):
        if self.wallet_address:
            self.wallet_address = self.wallet_address.lower()

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.display_name or self.wallet_address}"
