from django.db import models


class AuditEventQuerySet(models.QuerySet):
    """QuerySet that enforces append-only immutability by rejecting bulk updates and deletes."""

    def update(self, *args, **kwargs):
        raise PermissionError("AuditEvent records are strictly immutable and cannot be updated.")

    def delete(self):
        raise PermissionError("AuditEvent records are strictly immutable and cannot be deleted.")


class AuditEventManager(models.Manager.from_queryset(AuditEventQuerySet)):
    """Manager for AuditEvent enforcing immutability."""
    pass


class AuditEvent(models.Model):
    """Immutable, append-only log of security-sensitive events in LUCENTRA."""

    objects = AuditEventManager()

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

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise PermissionError("AuditEvent records are strictly immutable and cannot be updated once saved.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("AuditEvent records are strictly immutable and cannot be deleted.")

    def __str__(self):
        return f"[{self.created_at}] {self.action} on {self.resource_type}:{self.resource_id} by {self.actor}"
