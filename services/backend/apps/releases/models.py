from django.db import models
from apps.publishers.models import ETH_ADDRESS_REGEX, validate_eth_address
from apps.domains.models import Domain


class SigningKeyStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    REVOKED = "REVOKED", "Revoked"


class SigningKey(models.Model):
    """Represents an operational release-signing key authorized for a domain."""

    domain = models.ForeignKey(
        Domain,
        on_delete=models.CASCADE,
        related_name="signing_keys",
    )
    public_address = models.CharField(
        max_length=42,
        db_index=True,
        validators=[validate_eth_address],
        help_text="Checksummed or lowercase 0x-prefixed EVM address of signing key",
    )
    status = models.CharField(
        max_length=32,
        choices=SigningKeyStatus.choices,
        default=SigningKeyStatus.ACTIVE,
    )
    authorized_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "signing_keys"
        unique_together = ("domain", "public_address")
        ordering = ["-authorized_at"]

    def clean(self):
        if self.public_address:
            self.public_address = self.public_address.lower()

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.public_address} ({self.domain.canonical_domain})"


class ReleaseStatus(models.TextChoices):
    SUBMITTED = "SUBMITTED", "Submitted"
    ATTESTED = "ATTESTED", "Attested"
    VERIFIED = "VERIFIED", "Verified"
    REVOKED = "REVOKED", "Revoked"
    FAILED = "FAILED", "Failed"


class Release(models.Model):
    """Represents a verified release manifest registered and attested for a domain."""

    domain = models.ForeignKey(
        Domain,
        on_delete=models.CASCADE,
        related_name="releases",
    )
    manifest_hash = models.CharField(
        max_length=66,
        db_index=True,
        help_text="SHA-256 canonical manifest hash (0x...)",
    )
    version = models.CharField(
        max_length=64,
        help_text="Release version string (e.g. 1.0.0)",
    )
    sequence = models.BigIntegerField(
        help_text="Strictly monotonic release sequence number",
    )
    previous_manifest_hash = models.CharField(
        max_length=66,
        help_text="Hash of previous release manifest (or 0x0...0 for genesis)",
    )
    signing_key = models.ForeignKey(
        SigningKey,
        on_delete=models.PROTECT,
        related_name="signed_releases",
    )
    timestamp = models.BigIntegerField(
        help_text="Release publication timestamp (Unix epoch seconds)",
    )
    expires_at = models.BigIntegerField(
        help_text="Attestation expiry timestamp (Unix epoch seconds)",
    )
    signature = models.TextField(
        help_text="65-byte ECDSA release signature (0x-prefixed hex)",
    )
    manifest_json = models.JSONField(
        help_text="Canonical manifest document body",
    )
    attestation_uid = models.CharField(
        max_length=66,
        blank=True,
        null=True,
        db_index=True,
        help_text="EAS attestation UID (bytes32 hex)",
    )
    transaction_hash = models.CharField(
        max_length=66,
        blank=True,
        null=True,
        help_text="EAS attestation transaction hash (0x...)",
    )
    status = models.CharField(
        max_length=32,
        choices=ReleaseStatus.choices,
        default=ReleaseStatus.SUBMITTED,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "releases"
        unique_together = ("domain", "sequence")
        ordering = ["-sequence"]

    def __str__(self):
        return f"{self.domain.canonical_domain} v{self.version} (seq: {self.sequence})"
