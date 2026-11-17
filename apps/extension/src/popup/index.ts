/**
 * @file popup/index.ts
 * @package @lucentra/extension
 * @description Controller for the LUCENTRA Trust-Status Popup UI.
 */

import type { TabVerificationState } from "../types/verification.js";
import type { MessageResponse } from "../types/messages.js";
import { STATUS_DESCRIPTIONS, BADGE_CONFIG } from "../shared/constants.js";
import { truncateAddress, truncateDigest } from "../utils/formatting.js";

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

// Initial boot
fetchTabAndVerify(false);
