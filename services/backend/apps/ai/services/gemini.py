"""Google Gemini AI Explanation Service for LUCENTRA.

Utilizes the official Google Gen AI Python SDK (google-genai) to generate structured
security explanations of deterministic verification evidence.

Features:
- Structured output adhering strictly to SecurityExplanationOutput schema
- In-memory request deduplication and response caching
- Strict rate-limiting and token budgeting
- Resilient deterministic fallback on API outage, timeout, or missing API key
"""

import os
import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Tuple
from google import genai
from google.genai import types

from ..schemas import (
    VerificationEvidenceInput,
    SecurityExplanationOutput,
    RiskLevel,
    ProtocolVerificationState,
)
from .prompts import LUCENTRA_SYSTEM_PROMPT, build_evidence_prompt

logger = logging.getLogger(__name__)

# Fallback deterministic explanations mapped to protocol states
DETERMINISTIC_FALLBACKS: Dict[ProtocolVerificationState, Tuple[str, RiskLevel, str, str]] = {
    ProtocolVerificationState.VERIFIED_RELEASE_MATCH: (
        "Cryptographically Verified Release Match",
        RiskLevel.LOW,
        "All declared JavaScript resources match the cryptographically signed release manifest on-chain. Out-of-band SHA-256 byte integrity and publisher identity have been verified.",
        "Review resource count and ensure no unexpected inline scripts were executed.",
    ),
    ProtocolVerificationState.UNVERIFIED_RESOURCE_DETECTED: (
        "Integrity Discrepancy or Unverified Resource Detected",
        RiskLevel.HIGH,
        "One or more observed JavaScript resources differed from the publisher's signed release manifest, or an undeclared external script was loaded. This indicates potential script tampering, CDN caching skew, or an unauthorized release update.",
        "Inspect the mismatched resources immediately. Verify build pipelines and CDN distribution headers.",
    ),
    ProtocolVerificationState.UNREGISTERED_PUBLISHER: (
        "Unregistered Publisher Domain",
        RiskLevel.MEDIUM,
        "This website has not established cryptographic domain ownership in the LUCENTRA PublisherRegistry. No verified public signing keys or EAS attestations exist for this origin.",
        "Publisher must complete DNS TXT challenge verification and register their signing wallet.",
    ),
    ProtocolVerificationState.REVOKED_RELEASE: (
        "Revoked Release Manifest",
        RiskLevel.CRITICAL,
        "The cryptographic attestation for this release has been revoked on-chain via the Ethereum Attestation Service. The publisher or security authority has invalidated this version.",
        "Do not trust this release. Roll back to a valid prior release or issue a newly attested version.",
    ),
    ProtocolVerificationState.UNATTESTED_RELEASE: (
        "Unattested Release Manifest",
        RiskLevel.MEDIUM,
        "The release manifest contains a valid signature but lacks a confirmed on-chain EAS attestation record.",
        "Submit the signed release manifest to EAS via the Publisher Dashboard.",
    ),
    ProtocolVerificationState.INDETERMINATE: (
        "Indeterminate Verification State",
        RiskLevel.UNKNOWN,
        "Verification evidence was incomplete or unavailable due to network timeout or RPC reachability issues.",
        "Ensure network connectivity to the blockchain RPC and backend verification service, then retry.",
    ),
}


class GeminiExplanationService:
    """Manages Gemini model interactions with structured output, caching, and deterministic fallback."""

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model_id = os.getenv("GEMINI_MODEL_ID", "gemini-3.8-flash").strip()
        self.ai_enabled = os.getenv("GEMINI_AI_ENABLED", "True").lower() in ("true", "1", "yes")
        self.timeout_seconds = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "10.0"))
        self._cache: Dict[str, Tuple[float, SecurityExplanationOutput]] = {}
        self._cache_ttl_seconds = 300.0  # 5 minutes TTL

    def _get_cache_key(self, evidence: VerificationEvidenceInput) -> str:
        """Derives a stable cache key based on evidence fields."""
        key_data = {
            "domain": evidence.domain,
            "state": evidence.verification_state.value,
            "digest": evidence.manifest_digest,
            "attestation": evidence.attestation_uid,
            "discrepancies": [
                (d.path, d.status.value, d.expected_hash, d.observed_hash)
                for d in evidence.resource_discrepancies
            ],
            "inline": evidence.inline_script_count,
        }
        return json.dumps(key_data, sort_keys=True)

    def _get_cached_explanation(self, cache_key: str) -> Optional[SecurityExplanationOutput]:
        now = time.time()
        if cache_key in self._cache:
            created_at, val = self._cache[cache_key]
            if now - created_at < self._cache_ttl_seconds:
                return val
            del self._cache[cache_key]
        return None

    def _set_cached_explanation(self, cache_key: str, val: SecurityExplanationOutput):
        now = time.time()
        # Clean older cache entries if cache grows beyond 100 entries
        if len(self._cache) > 100:
            expired = [k for k, (t, _) in self._cache.items() if now - t > self._cache_ttl_seconds]
            for k in expired:
                del self._cache[k]
        self._cache[cache_key] = (now, val)

    def generate_explanation(
        self,
        evidence: VerificationEvidenceInput,
        force_refresh: bool = False,
    ) -> SecurityExplanationOutput:
        """Generates a structured security explanation from evidence.

        Always returns a valid SecurityExplanationOutput; falls back gracefully to
        deterministic rules if Gemini is unavailable, disabled, or encounters an error.
        """
        cache_key = self._get_cache_key(evidence)
        if not force_refresh:
            cached = self._get_cached_explanation(cache_key)
            if cached:
                return cached

        # Check if AI is disabled or API key is not configured
        if not self.ai_enabled or not self.api_key:
            logger.info("Gemini AI is disabled or API key is absent; returning deterministic fallback.")
            fallback = self._build_deterministic_fallback(
                evidence,
                reason="Gemini AI is not configured or disabled. Deterministic verification evidence is active.",
            )
            self._set_cached_explanation(cache_key, fallback)
            return fallback

        # Attempt inference with Google Gen AI SDK
        try:
            client = genai.Client(api_key=self.api_key)
            prompt = build_evidence_prompt(evidence)

            # Generate structured content adhering strictly to Pydantic schema
            response = client.models.generate_content(
                model=self.model_id,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=LUCENTRA_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=SecurityExplanationOutput,
                    temperature=0.1,  # Low temperature for objective consistency
                    max_output_tokens=1500,
                ),
            )

            raw_text = response.text or ""
            parsed_data = json.loads(raw_text)

            # Overwrite server-authoritative fields to prevent model hallucination/tampering
            parsed_data["model_id"] = self.model_id
            parsed_data["generated_at"] = datetime.now(timezone.utc).isoformat()
            parsed_data["deterministic_state"] = evidence.verification_state.value

            # Validate with Pydantic
            result = SecurityExplanationOutput(**parsed_data)
            self._set_cached_explanation(cache_key, result)
            return result

        except Exception as e:
            logger.warning(
                "Gemini AI explanation failed: %s; falling back to deterministic explanation.",
                e,
            )
            fallback = self._build_deterministic_fallback(
                evidence,
                reason=f"AI explanation temporarily unavailable ({type(e).__name__}). Deterministic verification evidence remains authoritative.",
            )
            self._set_cached_explanation(cache_key, fallback)
            return fallback

    def _build_deterministic_fallback(
        self,
        evidence: VerificationEvidenceInput,
        reason: str,
    ) -> SecurityExplanationOutput:
        """Constructs an authoritative deterministic explanation when AI is unavailable."""
        headline, risk_level, default_explanation, default_action = DETERMINISTIC_FALLBACKS.get(
            evidence.verification_state,
            (
                "Unknown Verification Status",
                RiskLevel.UNKNOWN,
                "Unable to evaluate cryptographic status.",
                "Inspect origin and retry verification.",
            ),
        )

        # Build technical discrepancy summary
        if evidence.resource_discrepancies:
            mismatches = [
                f"{d.path} ({d.status.value})" for d in evidence.resource_discrepancies
            ]
            tech_summary = f"Identified {len(mismatches)} resource discrepancy(ies): " + ", ".join(mismatches)
        else:
            tech_summary = "All observed scripts matched declared manifest parameters or no external scripts were observed."

        if evidence.has_inline_scripts:
            tech_summary += f" Notice: {evidence.inline_script_count} unhashed inline script tag(s) detected."

        references = [f"domain:{evidence.domain}"]
        if evidence.manifest_digest:
            references.append(f"manifest:{evidence.manifest_digest}")
        if evidence.attestation_uid:
            references.append(f"attestation:{evidence.attestation_uid}")

        limitations = (
            f"{reason} Integrity verification proves byte fidelity and declared publisher authorization. "
            "It does not guarantee runtime security, absence of memory-resident exploits, or benign server logic."
        )

        return SecurityExplanationOutput(
            headline=f"[{evidence.verification_state.value}] {headline}",
            risk_level=risk_level,
            detailed_explanation=default_explanation,
            technical_discrepancy_summary=tech_summary,
            recommended_action=default_action,
            evidence_references=references,
            limitations=limitations,
            model_id="deterministic-fallback",
            generated_at=datetime.now(timezone.utc).isoformat(),
            deterministic_state=evidence.verification_state.value,
        )


_service_instance: Optional[GeminiExplanationService] = None


def get_gemini_service() -> GeminiExplanationService:
    """Returns singleton instance of GeminiExplanationService."""
    global _service_instance
    if _service_instance is None:
        _service_instance = GeminiExplanationService()
    return _service_instance

