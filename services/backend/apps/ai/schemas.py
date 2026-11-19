"""Pydantic schemas for LUCENTRA AI Evidence Explanation Service.

Strictly bounded, typed evidence objects for input sanitization and structured model generation.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ProtocolVerificationState(str, Enum):
    VERIFIED_RELEASE_MATCH = "VERIFIED_RELEASE_MATCH"
    UNVERIFIED_RESOURCE_DETECTED = "UNVERIFIED_RESOURCE_DETECTED"
    UNREGISTERED_PUBLISHER = "UNREGISTERED_PUBLISHER"
    REVOKED_RELEASE = "REVOKED_RELEASE"
    UNATTESTED_RELEASE = "UNATTESTED_RELEASE"
    INDETERMINATE = "INDETERMINATE"


class ObservationCompleteness(str, Enum):
    COMPLETE = "COMPLETE"
    INCOMPLETE = "INCOMPLETE"


class DiscrepancyStatus(str, Enum):
    MATCH = "MATCH"
    MISMATCH = "MISMATCH"
    MISSING_ON_SERVER = "MISSING_ON_SERVER"
    UNEXPECTED_RESOURCE = "UNEXPECTED_RESOURCE"
    FAILED_FETCH = "FAILED_FETCH"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
    UNKNOWN = "UNKNOWN"


class ResourceDiscrepancy(BaseModel):
    path: str = Field(..., max_length=512, description="Normalized relative path or URL of resource")
    status: DiscrepancyStatus = Field(..., description="Integrity status of resource")
    expected_hash: Optional[str] = Field(None, max_length=128, description="Expected SHA-256 hash from signed manifest")
    observed_hash: Optional[str] = Field(None, max_length=128, description="Observed SHA-256 hash from network fetch")

    @field_validator("path")
    @classmethod
    def sanitize_path(cls, v: str) -> str:
        # Strip query params, fragment, and control characters
        clean = v.split("?")[0].split("#")[0].strip()
        return clean[:512]


class VerificationEvidenceInput(BaseModel):
    domain: str = Field(..., min_length=1, max_length=253, description="Canonical domain name")
    verification_state: ProtocolVerificationState = Field(..., description="Deterministic verification state")
    publisher_registered: bool = Field(False, description="Whether publisher is registered on-chain")
    publisher_address: Optional[str] = Field(None, max_length=42, description="Publisher wallet EVM address")
    release_version: Optional[str] = Field(None, max_length=64, description="Release version string")
    sequence: Optional[int] = Field(None, ge=0, description="Release sequence number")
    manifest_digest: Optional[str] = Field(None, max_length=66, description="Canonical manifest hash 0x...")
    attestation_uid: Optional[str] = Field(None, max_length=66, description="EAS attestation UID 0x...")
    is_attested: Optional[bool] = Field(False, description="Whether EAS attestation is confirmed on-chain")
    is_revoked: Optional[bool] = Field(False, description="Whether release or attestation is revoked")
    resource_discrepancies: List[ResourceDiscrepancy] = Field(default_factory=list, max_length=50)
    inline_script_count: int = Field(0, ge=0, description="Number of inline scripts detected")
    has_inline_scripts: bool = Field(False, description="Whether inline scripts were observed")
    observation_completeness: ObservationCompleteness = Field(
        ObservationCompleteness.COMPLETE,
        description="Coverage completeness of observed resources",
    )
    evaluation_timestamp: Optional[int] = Field(None, ge=0, description="Unix timestamp of evaluation")

    @field_validator("domain")
    @classmethod
    def sanitize_domain(cls, v: str) -> str:
        clean = v.strip().lower()
        if len(clean) > 253 or not clean:
            raise ValueError("Domain must be between 1 and 253 characters.")
        return clean


class SecurityExplanationOutput(BaseModel):
    """Strict structured output model for Gemini explanations."""
    headline: str = Field(..., description="Concise one-sentence status headline")
    risk_level: RiskLevel = Field(..., description="Calculated advisory risk level")
    detailed_explanation: str = Field(
        ...,
        description="Plain-English explanation of what the cryptographic evidence proves and does not prove",
    )
    technical_discrepancy_summary: str = Field(
        ...,
        description="Technical breakdown of observed vs expected resources and cryptographic parameters",
    )
    recommended_action: str = Field(
        ...,
        description="Recommended next investigation or remediation steps for user or publisher",
    )
    evidence_references: List[str] = Field(
        default_factory=list,
        description="Key evidence identifiers referenced in the explanation (e.g. attestation UID, domain, paths)",
    )
    limitations: str = Field(
        ...,
        description="Explicit disclosure of verification limitations (e.g. integrity != benign safety)",
    )
    model_id: str = Field(..., description="Gemini model identifier used for inference or fallback indicator")
    generated_at: str = Field(..., description="ISO 8601 generation timestamp")
    deterministic_state: str = Field(..., description="Authoritative protocol verification state")

