from django.db import models
from apps.releases.models import Release


class Attestation(models.Model):
    """Represents an EAS attestation indexed from Ethereum Attestation Service."""

    release = models.OneToOneField(
        Release,
        on_delete=models.CASCADE,
        related_name="attestation",
        null=True,
        blank=True,
    )
    uid = models.CharField(
        max_length=66,
        unique=True,
        db_index=True,
        help_text="EAS Attestation UID (0x...)",
    )
    schema_uid = models.CharField(
        max_length=66,
        help_text="EAS Schema UID (0x...)",
    )
    attester_address = models.CharField(
        max_length=42,
        help_text="Attester address (ReleaseAttestationVerifier contract)",
    )
    transaction_hash = models.CharField(
        max_length=66,
        help_text="Transaction hash in which attestation was created",
    )
    revoked = models.BooleanField(
        default=False,
        help_text="Whether this attestation has been revoked",
    )
    revocation_time = models.BigIntegerField(
        default=0,
        help_text="Unix timestamp when revocation occurred (0 if active)",
    )
    indexed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "attestations"
        ordering = ["-indexed_at"]

    def __str__(self):
        return f"Attestation {self.uid[:10]}... (revoked={self.revoked})"
