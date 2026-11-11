from django.db import models


class AuditEvent(models.Model):
    """Immutable log of security-sensitive events in LUCENTRA."""

    actor = models.CharField(
        max_length=128,
        default="system",
        help_text="Identity or address of actor who performed the action",
    )
    action = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Action identifier (e.g. DOMAIN_REGISTERED, DNS_VERIFIED)",
    )
    resource_type = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Type of resource impacted (e.g. Domain, Release, Challenge)",
    )
    resource_id = models.CharField(
        max_length=128,
        help_text="Identifier of the impacted resource",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured context about the event",
    )
    ip_address = models.CharField(
        max_length=45,
        blank=True,
        null=True,
        help_text="Client IP address if available",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    class Meta:
        db_table = "audit_events"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.created_at}] {self.action} on {self.resource_type}:{self.resource_id} by {self.actor}"
