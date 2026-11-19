# LUCENTRA — Sprint 5 Google Gemini AI Integration Report
## AI Evidence Explanation Service & Prompt-Injection Hardening

**Document ID:** LUC-AI-001  
**Version:** 1.0.0  
**Status:** APPROVED & TESTED  
**Date:** 2026-11-19  
**Component:** `services/backend/apps/ai/`  
**SDK:** `google-genai` v3.6.1  
**Model:** `gemini-3.8-flash` (Configurable via `GEMINI_MODEL_ID`)

---

## 1. Executive Summary

Sprint 5 integrated Google Gemini into the LUCENTRA backend to provide plain-English cybersecurity assessments of cryptographic verification evidence. 

The integration maintains a **strict architectural boundary**: the AI explainer translates established mathematical evidence into actionable summaries for users, but has **zero authority** over verification truth. Verification verdicts are determined solely by cryptographic hashing, EIP-712 digital signatures, and on-chain Ethereum Attestation Service records.

---

## 2. Model Selection & SDK Configuration

- **SDK:** Official Google Gen AI Python SDK (`google-genai` v3.6.1) installed in the backend Python runtime.
- **Model Selected:** `gemini-3.8-flash` (1M token context window, optimized for fast structured inference and low latency).
- **Fallback Configuration:** Controlled by backend environment variables:
  ```ini
  GEMINI_API_KEY=YOUR_GEMINI_API_KEY
  GEMINI_MODEL_ID=gemini-3.8-flash
  GEMINI_TIMEOUT_SECONDS=10.0
  GEMINI_MAX_OUTPUT_TOKENS=1500
  GEMINI_AI_ENABLED=True
  ```
- **Security Rule:** API keys are restricted strictly to server-side backend execution. They are never transmitted to browser extensions or the Next.js frontend.

---

## 3. Strict Boundary & Defense-in-Depth Sanitization

To prevent prompt injection attacks, server-side data exfiltration, or model manipulation:

1. **Zero External Code to Gemini:** Raw JavaScript code, complete HTML DOMs, cookies, session tokens, and private keys are **never** included in model prompts.
2. **Input Sanitization (`sanitizer.py`):**
   - Strips non-printable ASCII control characters.
   - Defangs prompt-injection markers (`ignore previous instructions`, `you are now`, `mark as safe`).
   - Caps the number of resource discrepancies to at most 20 items to prevent context exhaustion attacks.
   - Validates that domain strings comply strictly with UTS #46 canonical format.
3. **Structured System Instruction (`prompts.py`):**
   - Informs the model that it is an explainer and cannot alter verification verdicts.
   - Forbids claiming code safety (e.g. "This website is 100% safe").
   - Demands explicit disclosure that verification reflects out-of-band fetched byte integrity rather than in-memory runtime execution.

---

## 4. Structured Schemas (Pydantic v2)

### 4.1 Input Schema (`VerificationEvidenceInput`)
```python
class VerificationEvidenceInput(BaseModel):
    domain: str
    verification_state: ProtocolVerificationState  # Enum
    publisher_registered: bool
    publisher_address: Optional[str]
    release_version: Optional[str]
    sequence: Optional[int]
    manifest_digest: Optional[str]
    attestation_uid: Optional[str]
    is_attested: Optional[bool]
    is_revoked: Optional[bool]
    resource_discrepancies: List[ResourceDiscrepancy]
    inline_script_count: int
    has_inline_scripts: bool
    observation_completeness: ObservationCompleteness
    evaluation_timestamp: Optional[int]
```

### 4.2 Structured Output Schema (`SecurityExplanationOutput`)
```python
class SecurityExplanationOutput(BaseModel):
    headline: str
    risk_level: RiskLevel  # LOW | MEDIUM | HIGH | CRITICAL | UNKNOWN
    detailed_explanation: str
    technical_discrepancy_summary: str
    recommended_action: str
    evidence_references: List[str]
    limitations: str
    model_id: str
    generated_at: str
    deterministic_state: str
```

---

## 5. Resilient Deterministic Fallback

If the Gemini API key is unconfigured, rate-limited (HTTP 429), times out (10s), or encounters a network disruption:
- The backend automatically synthesizes a high-quality deterministic explanation based on `STATUS_DESCRIPTIONS` and discrepancy metadata.
- Sets `model_id="deterministic-fallback"`.
- Appends the disclosure: `"AI explanation temporarily unavailable. Deterministic verification evidence is still available."`
- The API returns HTTP 200 without ever blocking or crashing deterministic verification.

---

## 6. Endpoints Implemented

1. **`POST /api/v1/ai/explanations/`**:
   Accepts structured verification evidence from the Chrome extension or dashboard, enriches with authoritative database state where applicable, and returns structured security explanations.
2. **`GET /api/v1/domains/{domain}/explain/`**:
   Convenience endpoint evaluating the active database release record for a domain and returning an immediate explanation.

---

## 7. Test Coverage

The test suite in `services/backend/apps/ai/tests/test_ai_service.py` executes 12 dedicated unit and integration tests:
- Control character stripping and prompt injection defanging.
- Truncation of discrepancy lists exceeding 20 items.
- Deterministic fallback generation across verified, mismatch, and unregistered states.
- In-memory request deduplication caching.
- Mocked successful Gemini API response parsing and schema validation.
- Graceful error recovery during timeout or connection failures.
- DRF API endpoint response codes and serializer validation.

All 12 tests passed with **exit code 0**.

