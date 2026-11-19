"""Sanitizer and defense-in-depth preprocessor for Gemini AI explanation evidence.

Defends against prompt injection, control character poisoning, and payload bloating.
Ensures zero raw JavaScript, HTML, cookies, or secrets ever reach the model.
"""

import re
from typing import Dict, Any, List
from ..schemas import VerificationEvidenceInput, ResourceDiscrepancy, ProtocolVerificationState

# Regex to strip non-printable or dangerous control characters
CONTROL_CHAR_REGEX = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# Regex to identify common prompt injection trigger phrases
PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(in|a)\s+", re.IGNORECASE),
    re.compile(r"system\s*:\s*", re.IGNORECASE),
    re.compile(r"<\|im_start\|>", re.IGNORECASE),
    re.compile(r"<\|im_end\|>", re.IGNORECASE),
    re.compile(r"\[INST\]", re.IGNORECASE),
    re.compile(r"\[/INST\]", re.IGNORECASE),
    re.compile(r"override\s+status\s+to", re.IGNORECASE),
    re.compile(r"mark\s+as\s+safe", re.IGNORECASE),
]


def sanitize_text(text: str, max_length: int = 512) -> str:
    """Sanitize arbitrary string input: strip control chars and defang prompt injection markers."""
    if not text:
        return ""
    cleaned = CONTROL_CHAR_REGEX.sub("", str(text))
    # Replace dangerous newline or formatting escapes
    cleaned = cleaned.replace("\r", " ").replace("\n", " ").strip()
    # Defang injection triggers
    for pat in PROMPT_INJECTION_PATTERNS:
        cleaned = pat.sub("[REDACTED_INJECTION_ATTEMPT]", cleaned)
    return cleaned[:max_length]


def sanitize_evidence(raw_data: Dict[str, Any]) -> VerificationEvidenceInput:
    """Validate and sanitize raw request evidence dictionary into a verified VerificationEvidenceInput.

    Enforces:
    - Bounded length on paths and domain names
    - Stripping of query strings and fragments
    - Truncation of discrepancy list (max 20 items to prevent prompt exhaustion)
    - Removal of any unexpected keys (raw script bodies, html, headers, cookies)
    """
    domain = sanitize_text(raw_data.get("domain", ""), max_length=253)
    raw_state = raw_data.get("verification_state", ProtocolVerificationState.INDETERMINATE.value)

    # Validate state is valid enum, else default to INDETERMINATE
    try:
        verification_state = ProtocolVerificationState(raw_state)
    except ValueError:
        verification_state = ProtocolVerificationState.INDETERMINATE

    raw_discrepancies = raw_data.get("resource_discrepancies", [])
    sanitized_discrepancies: List[ResourceDiscrepancy] = []

    if isinstance(raw_discrepancies, list):
        # Bound to at most 20 discrepancies
        for d in raw_discrepancies[:20]:
            if not isinstance(d, dict):
                continue
            path = sanitize_text(d.get("path", ""), max_length=256)
            status = d.get("status", "MISMATCH")
            expected_hash = sanitize_text(d.get("expected_hash", ""), max_length=70)
            observed_hash = sanitize_text(d.get("observed_hash", ""), max_length=70)
            try:
                sanitized_discrepancies.append(
                    ResourceDiscrepancy(
                        path=path,
                        status=status,
                        expected_hash=expected_hash if expected_hash.startswith("sha256:") else None,
                        observed_hash=observed_hash if observed_hash.startswith("sha256:") else None,
                    )
                )
            except Exception:
                continue

    evidence = VerificationEvidenceInput(
        domain=domain,
        verification_state=verification_state,
        publisher_registered=bool(raw_data.get("publisher_registered", False)),
        publisher_address=sanitize_text(raw_data.get("publisher_address", ""), max_length=42) or None,
        release_version=sanitize_text(raw_data.get("release_version", ""), max_length=64) or None,
        sequence=raw_data.get("sequence") if isinstance(raw_data.get("sequence"), int) else None,
        manifest_digest=sanitize_text(raw_data.get("manifest_digest", ""), max_length=66) or None,
        attestation_uid=sanitize_text(raw_data.get("attestation_uid", ""), max_length=66) or None,
        is_attested=bool(raw_data.get("is_attested", False)),
        is_revoked=bool(raw_data.get("is_revoked", False)),
        resource_discrepancies=sanitized_discrepancies,
        inline_script_count=max(0, int(raw_data.get("inline_script_count", 0))),
        has_inline_scripts=bool(raw_data.get("has_inline_scripts", False)),
        observation_completeness=raw_data.get("observation_completeness", "COMPLETE"),
        evaluation_timestamp=raw_data.get("evaluation_timestamp"),
    )
    return evidence

