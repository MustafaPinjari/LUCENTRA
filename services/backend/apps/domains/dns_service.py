"""DNS TXT verification service using dnspython.

Complies with AGENTS.md:
- Real DNS verification via RFC 1035 standard lookups.
- Configurable timeout and attempt throttling.
- Dependency injection for mock resolver in unit/integration tests.
"""

import logging
import secrets
from typing import Any, Callable, Dict, List, Optional
from django.conf import settings
from django.utils import timezone
import dns.resolver
import dns.exception

logger = logging.getLogger(__name__)


class DNSVerificationError(Exception):
    """Base exception for DNS verification errors."""
    pass


class DNSChallengeExpiredError(DNSVerificationError):
    """Raised when the DNS challenge has expired."""
    pass


class DNSMaxAttemptsExceededError(DNSVerificationError):
    """Raised when the DNS verification attempts exceed max allowed."""
    pass


class DNSService:
    """Performs DNS TXT challenge creation and validation."""

    def __init__(self, resolver: Optional[Any] = None):
        """Optionally inject a custom dns.resolver.Resolver or mock for testing."""
        self._custom_resolver = resolver

    def _get_resolver(self) -> dns.resolver.Resolver:
        if self._custom_resolver is not None:
            return self._custom_resolver

        res = dns.resolver.Resolver()
        timeout = getattr(settings, "DNS_TIMEOUT_SECONDS", 5.0)
        res.timeout = timeout
        res.lifetime = timeout
        return res

    @staticmethod
    def generate_challenge_token() -> str:
        """Generate a cryptographically secure 32-byte hex token (64 chars)."""
        return secrets.token_hex(32)

    @staticmethod
    def format_record_name(domain: str) -> str:
        """Return the FQDN for the verification TXT record."""
        prefix = getattr(settings, "DNS_CHALLENGE_PREFIX", "_lucentra-verification")
        clean_domain = domain.strip().lower().rstrip(".")
        return f"{prefix}.{clean_domain}"

    @staticmethod
    def format_record_value(challenge_value: str) -> str:
        """Return expected TXT record value."""
        return f"lucentra-verify={challenge_value}"

    def query_txt_records(self, record_name: str) -> List[str]:
        """Perform DNS query for TXT records at record_name, returning cleaned strings."""
        resolver = self._get_resolver()
        found_records: List[str] = []

        try:
            answers = resolver.resolve(record_name, "TXT")
            for rdata in answers:
                # rdata.strings is a list of byte chunks for the TXT record
                # e.g. [b'lucentra-verify=abc']
                if hasattr(rdata, "strings"):
                    txt = "".join(part.decode("utf-8", errors="replace") for part in rdata.strings)
                else:
                    txt = str(rdata).strip('"')
                found_records.append(txt.strip())
        except dns.resolver.NXDOMAIN:
            logger.debug("DNS NXDOMAIN for %s", record_name)
        except dns.resolver.NoAnswer:
            logger.debug("DNS NoAnswer for %s (domain exists but no TXT record)", record_name)
        except dns.resolver.Timeout:
            logger.warning("DNS query timed out for %s", record_name)
            raise DNSVerificationError(f"DNS lookup timed out for {record_name}")
        except dns.exception.DNSException as e:
            logger.warning("DNS resolution exception for %s: %s", record_name, e)
            raise DNSVerificationError(f"DNS resolution error: {str(e)}")

        return found_records

    def verify_challenge(self, challenge) -> Dict[str, Any]:
        """Verify that the DNS TXT record matching challenge.record_value exists."""
        if challenge.is_expired:
            raise DNSChallengeExpiredError("The DNS challenge has expired. Please request a new challenge.")

        max_attempts = getattr(settings, "DNS_CHALLENGE_MAX_ATTEMPTS", 5)
        if challenge.attempts >= max_attempts:
            raise DNSMaxAttemptsExceededError(
                f"Maximum verification attempts ({max_attempts}) exceeded for this challenge."
            )

        challenge.attempts += 1
        challenge.save(update_fields=["attempts"])

        record_name = challenge.record_name
        expected_value = challenge.record_value

        try:
            found_records = self.query_txt_records(record_name)
        except DNSVerificationError as e:
            return {
                "verified": False,
                "record_name": record_name,
                "expected_value": expected_value,
                "found_records": [],
                "error": str(e),
            }

        verified = False
        for rec in found_records:
            clean_rec = rec.strip().strip('"')
            if clean_rec == expected_value:
                verified = True
                break
            # Also allow case-insensitive prefix match if value matches
            if clean_rec.lower() == expected_value.lower():
                verified = True
                break

        if verified:
            now = timezone.now()
            challenge.verified_at = now
            challenge.save(update_fields=["verified_at"])

            domain = challenge.domain
            domain.registration_status = "DNS_VERIFIED"
            domain.last_verified_at = now
            domain.save(update_fields=["registration_status", "last_verified_at"])

        return {
            "verified": verified,
            "record_name": record_name,
            "expected_value": expected_value,
            "found_records": found_records,
            "error": None if verified else "Expected verification TXT record was not found.",
        }


# Default service instance
_dns_service_instance: Optional[DNSService] = None


def get_dns_service(custom_resolver: Optional[Any] = None) -> DNSService:
    """Return default or custom DNSService instance."""
    if custom_resolver is not None:
        return DNSService(resolver=custom_resolver)
    global _dns_service_instance
    if _dns_service_instance is None:
        _dns_service_instance = DNSService()
    return _dns_service_instance
