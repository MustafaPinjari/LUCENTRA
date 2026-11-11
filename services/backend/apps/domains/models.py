from django.db import models
from django.utils import timezone
from apps.publishers.models import Publisher
import re

DOMAIN_REGEX = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
)


def normalize_domain_name(domain: str) -> str:
    """Normalize domain to lowercase, stripped of whitespace and trailing dots."""
    if not domain or not isinstance(domain, str):
        return ""
    normalized = domain.strip().lower()
    if normalized.endswith("."):
        normalized = normalized[:-1]
    return normalized


class DomainStatus(models.TextChoices):
    PENDING_DNS = "PENDING_DNS", "Pending DNS Verification"
    DNS_VERIFIED = "DNS_VERIFIED", "DNS Verified"
    REGISTERED_ONCHAIN = "REGISTERED_ONCHAIN", "Registered On-Chain"
    SUSPENDED = "SUSPENDED", "Suspended"
    REVOKED = "REVOKED", "Revoked"


class Domain(models.Model):
    """Represents a registered website domain linked to a publisher wallet."""

    publisher = models.ForeignKey(
        Publisher,
        on_delete=models.CASCADE,
        related_name="domains",
    )
    canonical_domain = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Canonical normalized domain name (e.g. example.com)",
    )
    registration_status = models.CharField(
        max_length=32,
        choices=DomainStatus.choices,
        default=DomainStatus.PENDING_DNS,
        db_index=True,
    )
    onchain_registration_transaction = models.CharField(
        max_length=66,
        blank=True,
        null=True,
        help_text="EVM transaction hash of on-chain registration (0x...)",
    )
    chain_id = models.IntegerField(
        default=31337,
        help_text="EVM Chain ID where registration is recorded",
    )
    registered_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Timestamp when on-chain registration was mined",
    )
    last_verified_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Timestamp when DNS ownership was last re-verified",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "domains"
        ordering = ["-created_at"]

    def clean(self):
        if self.canonical_domain:
            self.canonical_domain = normalize_domain_name(self.canonical_domain)

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.canonical_domain} ({self.registration_status})"


class DNSChallenge(models.Model):
    """Represents a cryptographic DNS TXT challenge issued for domain ownership verification."""

    domain = models.ForeignKey(
        Domain,
        on_delete=models.CASCADE,
        related_name="dns_challenges",
    )
    challenge_value = models.CharField(
        max_length=128,
        db_index=True,
        help_text="High-entropy random hex token",
    )
    nonce = models.CharField(
        max_length=64,
        help_text="Random nonce identifying this challenge session",
    )
    record_name = models.CharField(
        max_length=255,
        help_text="Full DNS TXT record name: _lucentra-verification.<domain>",
    )
    record_value = models.CharField(
        max_length=255,
        help_text="Expected DNS TXT record value: lucentra-verify=<challenge_value>",
    )
    expires_at = models.DateTimeField(
        help_text="Expiry time after which this challenge cannot be verified",
    )
    attempts = models.IntegerField(
        default=0,
        help_text="Number of verification attempts made against this challenge",
    )
    verified_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Timestamp when DNS TXT record was successfully verified",
    )
    consumed_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Timestamp when challenge was consumed by on-chain registration",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "dns_challenges"
        ordering = ["-created_at"]

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_consumed(self) -> bool:
        return self.consumed_at is not None

    @property
    def is_valid_for_verification(self) -> bool:
        return not self.is_expired and not self.is_consumed

    def __str__(self):
        return f"Challenge {self.challenge_value[:8]} for {self.domain.canonical_domain}"
