/**
 * @file popup/index.ts
 * @package @lucentra/extension
 * @description Controller for the LUCENTRA Trust-Status Popup UI.
 */

import type { TabVerificationState } from "../types/verification.js";
import type { MessageResponse } from "../types/messages.js";
import { STATUS_DESCRIPTIONS, BADGE_CONFIG } from "../shared/constants.js";
import { truncateAddress, truncateDigest } from "../utils/formatting.js";
import { LucentraApiClient } from "../services/api-client.js";
import { DEFAULT_CONFIG } from "../types/config.js";

// DOM References
const elDomain = document.getElementById("current-domain")!;
const elStatusCard = document.getElementById("status-card")!;
const elStatusIcon = document.getElementById("status-icon")!;
const elStatusLabel = document.getElementById("status-label")!;
const elStatusStage = document.getElementById("status-stage")!;
const elStatusExplanation = document.getElementById("status-explanation")!;
const elInlineCautionBanner = document.getElementById("inline-caution-banner");
const elInlineCautionText = document.getElementById("inline-caution-text");
const elBtnReverify = document.getElementById("btn-reverify") as HTMLButtonElement;
const elBtnSpinner = document.getElementById("btn-spinner")!;
const elBtnText = document.getElementById("btn-text")!;

// AI DOM References
const elBtnExplainGemini = document.getElementById("btn-explain-gemini") as HTMLButtonElement | null;
const elAiSpinner = document.getElementById("ai-spinner") as HTMLElement | null;
const elAiBtnText = document.getElementById("ai-btn-text") as HTMLElement | null;
const elAiResultCard = document.getElementById("ai-result-card") as HTMLElement | null;
const elAiRiskBadge = document.getElementById("ai-risk-badge") as HTMLElement | null;
const elAiHeadline = document.getElementById("ai-headline") as HTMLElement | null;
const elAiExplanation = document.getElementById("ai-explanation") as HTMLElement | null;
const elAiDiscrepancies = document.getElementById("ai-discrepancies") as HTMLElement | null;
const elAiRecommendation = document.getElementById("ai-recommendation") as HTMLElement | null;
const elAiModelTag = document.getElementById("ai-model-tag") as HTMLElement | null;
const elAiTimestamp = document.getElementById("ai-timestamp") as HTMLElement | null;
const elAiLimitationsText = document.getElementById("ai-limitations-text") as HTMLElement | null;

const elValPublisher = document.getElementById("val-publisher")!;
const elValVersion = document.getElementById("val-version")!;
const elValManifestHash = document.getElementById("val-manifest-hash")!;
const elValAttestationUid = document.getElementById("val-attestation-uid")!;
const elValSigner = document.getElementById("val-signer")!;
const elResourceCount = document.getElementById("resource-count")!;
const elResourceList = document.getElementById("resource-list")!;

const elBtnCopyPublisher = document.getElementById("btn-copy-publisher") as HTMLButtonElement;
const elBtnCopyHash = document.getElementById("btn-copy-hash") as HTMLButtonElement;
const elBtnCopyUid = document.getElementById("btn-copy-uid") as HTMLButtonElement;

// Local state for copy handlers
let fullPublisher = "";
let fullManifestHash = "";
let fullAttestationUid = "";
let activeTabId: number | undefined;
let isAiLoading = false;
let currentVerificationState: TabVerificationState | null = null;

function setButtonLoading(loading: boolean): void {
  if (loading) {
    elBtnSpinner.classList.remove("hidden");
    elBtnText.textContent = "Verifying...";
    elBtnReverify.disabled = true;
  } else {
    elBtnSpinner.classList.add("hidden");
    elBtnText.textContent = "Re-verify";
    elBtnReverify.disabled = false;
  }
}

function copyToClipboard(button: HTMLButtonElement, text: string): void {
  if (!text || text === "—") return;
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.textContent = "✓";
    setTimeout(() => {
      button.textContent = originalText;
    }, 1500);
  });
}

function renderState(state: TabVerificationState): void {
  currentVerificationState = state;
  // Update domain
  elDomain.textContent = state.domain || "(non-web page)";

  // Update Status Card Classes
  elStatusCard.className = "status-card";
  const badgeInfo = BADGE_CONFIG[state.verificationState] || BADGE_CONFIG.INDETERMINATE;

  switch (state.verificationState) {
    case "VERIFIED_RELEASE_MATCH":
      elStatusCard.classList.add("state-verified");
      break;
    case "UNVERIFIED_RESOURCE_DETECTED":
      elStatusCard.classList.add("state-unverified");
      break;
    case "INDETERMINATE":
      elStatusCard.classList.add("state-indeterminate");
      break;
    case "REVOKED_RELEASE":
      elStatusCard.classList.add("state-revoked");
      break;
    case "UNREGISTERED_PUBLISHER":
      elStatusCard.classList.add("state-unregistered");
      break;
    case "UNATTESTED_RELEASE":
      elStatusCard.classList.add("state-indeterminate");
      break;
    default:
      elStatusCard.classList.add("state-unregistered");
  }

  elStatusIcon.textContent = badgeInfo.text;

  const desc = STATUS_DESCRIPTIONS[state.verificationState];
  elStatusLabel.textContent = desc ? desc.label : state.verificationState;
  elStatusStage.textContent = state.stage === "COMPLETE" ? "Verification complete" : `Stage: ${state.stage}`;
  elStatusExplanation.textContent = state.summary || (desc ? desc.explanation : "");

  // Update Inline Script Caution Indicator (LUC-SEC-041-06)
  if (elInlineCautionBanner) {
    if (state.hasInlineScripts) {
      elInlineCautionBanner.classList.remove("hidden");
      if (elInlineCautionText) {
        const count = state.inlineScriptCount ?? 1;
        const countLabel = count === 1 ? "1 inline script" : `${count} inline scripts`;
        elInlineCautionText.textContent = `Caution: ${countLabel} detected. Inline JavaScript is outside the supported external-resource verification scope.`;
      }
    } else {
      elInlineCautionBanner.classList.add("hidden");
    }
  }

  // Update Evidence Fields
  fullPublisher = state.publisherAddress || "";
  elValPublisher.textContent = truncateAddress(fullPublisher);

  elValVersion.textContent = state.releaseVersion || "—";

  fullManifestHash = state.releaseDigest || "";
  elValManifestHash.textContent = truncateDigest(fullManifestHash);

  fullAttestationUid = state.attestationUid || "";
  elValAttestationUid.textContent = truncateDigest(fullAttestationUid);

  elValSigner.textContent = truncateAddress(state.signerRecoveredAddress);

  // Render Observed Resources
  elResourceList.textContent = ""; // Clear existing

  const details = state.details || [];
  elResourceCount.textContent = String(details.length);

  if (details.length === 0) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "resource-empty";
    emptyEl.textContent = state.domain
      ? "No external script tags cataloged in active DOM."
      : "Not applicable on this page.";
    elResourceList.appendChild(emptyEl);
  } else {
    for (const detail of details) {
      const itemEl = document.createElement("div");
      itemEl.className = "resource-item";

      const pathEl = document.createElement("span");
      pathEl.className = "resource-path";
      pathEl.textContent = detail.path;
      pathEl.title = detail.path;

      const badgeEl = document.createElement("span");
      badgeEl.className = "resource-badge";

      switch (detail.status) {
        case "MATCH":
          badgeEl.classList.add("badge-match");
          badgeEl.textContent = "MATCH";
          break;
        case "MISMATCH":
          badgeEl.classList.add("badge-mismatch");
          badgeEl.textContent = "MISMATCH";
          break;
        case "MISSING":
          badgeEl.classList.add("badge-missing");
          badgeEl.textContent = "NOT LOADED";
          break;
        case "UNEXPECTED":
          badgeEl.classList.add("badge-unexpected");
          badgeEl.textContent = "UNDECLARED";
          break;
        default:
          badgeEl.classList.add("badge-failed");
          badgeEl.textContent = detail.status;
      }

      itemEl.appendChild(pathEl);
      itemEl.appendChild(badgeEl);
      elResourceList.appendChild(itemEl);
    }
  }
}

async function fetchTabAndVerify(forceVerify = false): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    elDomain.textContent = "localhost (Mock)";
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    elDomain.textContent = "No active tab";
    return;
  }

  activeTabId = tab.id;
  setButtonLoading(true);

  try {
    if (!forceVerify) {
      // First try to read cached state
      const response: MessageResponse<TabVerificationState> = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_TAB_STATE", tabId: activeTabId }, (res) => {
          resolve(res || { success: false });
        });
      });

      if (response && response.success && response.data) {
        renderState(response.data);
        setButtonLoading(false);
        return;
      }
    }

    // Trigger fresh verification
    const verifyResponse: MessageResponse<TabVerificationState> = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "TRIGGER_VERIFICATION", tabId: activeTabId }, (res) => {
        resolve(res || { success: false, error: "No response from background" });
      });
    });

    if (verifyResponse && verifyResponse.success && verifyResponse.data) {
      renderState(verifyResponse.data);
    } else {
      elStatusLabel.textContent = "Verification Failed";
      elStatusExplanation.textContent = verifyResponse?.error || "Unable to complete verification.";
    }
  } catch (err) {
    elStatusLabel.textContent = "Verification Error";
    elStatusExplanation.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    setButtonLoading(false);
  }
}

// Copy event listeners
elBtnCopyPublisher.addEventListener("click", () => copyToClipboard(elBtnCopyPublisher, fullPublisher));
elBtnCopyHash.addEventListener("click", () => copyToClipboard(elBtnCopyHash, fullManifestHash));
elBtnCopyUid.addEventListener("click", () => copyToClipboard(elBtnCopyUid, fullAttestationUid));

// Re-verify event listener
elBtnReverify.addEventListener("click", () => {
  fetchTabAndVerify(true);
});

async function explainWithGemini(): Promise<void> {
  if (isAiLoading || !elBtnExplainGemini) return;
  if (!currentVerificationState || !currentVerificationState.domain) {
    if (elStatusExplanation) {
      elStatusExplanation.textContent =
        "Please wait for verification to complete before requesting an AI explanation.";
    }
    return;
  }

  isAiLoading = true;
  if (elAiSpinner) elAiSpinner.classList.remove("hidden");
  if (elAiBtnText) elAiBtnText.textContent = "Analyzing with Gemini...";
  elBtnExplainGemini.disabled = true;

  try {
    const client = new LucentraApiClient({ baseUrl: DEFAULT_CONFIG.backendApiUrl });
    const payload = {
      domain: currentVerificationState.domain,
      verification_state: currentVerificationState.verificationState,
      publisher_registered: currentVerificationState.isRegisteredPublisher,
      publisher_address: currentVerificationState.publisherAddress,
      release_version: currentVerificationState.releaseVersion,
      manifest_digest: currentVerificationState.releaseDigest,
      attestation_uid: currentVerificationState.attestationUid,
      is_attested: currentVerificationState.isAttestedOnChain,
      is_revoked: currentVerificationState.isRevokedOnChain,
      resource_discrepancies: (currentVerificationState.details || []).map((d) => ({
        path: d.path,
        status: d.status,
        expected_hash: d.expectedHash,
        observed_hash: d.observedHash,
      })),
      inline_script_count: currentVerificationState.inlineScriptCount || 0,
      has_inline_scripts: currentVerificationState.hasInlineScripts || false,
      observation_completeness:
        currentVerificationState.unobservedManifestPaths &&
        currentVerificationState.unobservedManifestPaths.length > 0
          ? "INCOMPLETE"
          : "COMPLETE",
    };

    const explanation = await client.getAiExplanation(payload);

    if (elAiResultCard) elAiResultCard.classList.remove("hidden");
    if (elAiRiskBadge) {
      const riskLower = (explanation.risk_level || "unknown").toLowerCase();
      elAiRiskBadge.className = `risk-badge risk-${riskLower}`;
      elAiRiskBadge.textContent = `${explanation.risk_level} RISK`;
    }
    if (elAiHeadline) elAiHeadline.textContent = explanation.headline;
    if (elAiExplanation) elAiExplanation.textContent = explanation.detailed_explanation;
    if (elAiDiscrepancies) elAiDiscrepancies.textContent = explanation.technical_discrepancy_summary;
    if (elAiRecommendation) elAiRecommendation.textContent = explanation.recommended_action;
    if (elAiModelTag) elAiModelTag.textContent = `Model: ${explanation.model_id}`;
    if (elAiTimestamp) elAiTimestamp.textContent = new Date(explanation.generated_at).toLocaleTimeString();
    if (elAiLimitationsText) elAiLimitationsText.textContent = explanation.limitations;
  } catch (err: unknown) {
    if (elAiResultCard) elAiResultCard.classList.remove("hidden");
    if (elAiHeadline) elAiHeadline.textContent = "AI Explanation Unavailable";
    if (elAiExplanation) {
      elAiExplanation.textContent =
        "Could not contact Gemini AI service. Deterministic cryptographic verification remains fully active and authoritative.";
    }
    if (elAiRecommendation) {
      elAiRecommendation.textContent = "Inspect the deterministic cryptographic evidence table below.";
    }
  } finally {
    isAiLoading = false;
    if (elAiSpinner) elAiSpinner.classList.add("hidden");
    if (elAiBtnText) elAiBtnText.textContent = "✨ Explain with Gemini";
    elBtnExplainGemini.disabled = false;
  }
}

if (elBtnExplainGemini) {
  elBtnExplainGemini.addEventListener("click", explainWithGemini);
}

// Initial boot
fetchTabAndVerify(false);
