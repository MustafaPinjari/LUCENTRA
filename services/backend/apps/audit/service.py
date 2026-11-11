import logging
from typing import Any, Dict, Optional
from .models import AuditEvent

logger = logging.getLogger(__name__)


def record_audit_event(
    action: str,
    resource_type: str,
    resource_id: str,
    actor: str = "system",
    metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditEvent:
    """Record a security audit log entry."""
    try:
        event = AuditEvent.objects.create(
            actor=actor,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            metadata=metadata or {},
            ip_address=ip_address,
        )
        logger.info(
            "AuditEvent recorded: %s on %s:%s by %s",
            action,
            resource_type,
            resource_id,
            actor,
        )
        return event
    except Exception as e:
        logger.error("Failed to record AuditEvent: %s", e)
        raise
