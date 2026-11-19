"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "../../../components/WalletProvider";
import { api, DomainRecord, DNSChallengeRecord } from "../../../lib/api";
import { DEPLOYED_CONTRACTS } from "../../../lib/contracts";
import {
  Globe,
  Plus,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Shield,
  Clock,
  ArrowRight,
} from "lucide-react";

export default function DomainsPage() {
  const { address, isConnected, connectWallet, signRegistrationAuth } = useWallet();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Wizard state
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [inputDomain, setInputDomain] = useState<string>("");
  const [initialSigningKey, setInitialSigningKey] = useState<string>("");
  const [challenge, setChallenge] = useState<DNSChallengeRecord | null>(null);
  const [isVerifyingDns, setIsVerifyingDns] = useState<boolean>(false);
  const [dnsVerified, setDnsVerified] = useState<boolean>(false);
  const [isSubmittingOnChain, setIsSubmittingOnChain] = useState<boolean>(false);
  const [registrationResult, setRegistrationResult] = useState<any>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function loadDomains() {
    setLoading(true);
    try {
      const list = await api.listDomains();
      setDomains(list);
    } catch (e: any) {
      setError(e.message || "Failed to load domains");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDomains();
  }, []);

  useEffect(() => {
    if (address && !initialSigningKey) {
      // Default initial signing key to the publisher wallet or standard signing key address
      setInitialSigningKey(address);
    }
  }, [address, initialSigningKey]);

  function copyText(name: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(name);
    setTimeout(() => setCopiedField(null), 2000);
  }

  // Step 1 -> Step 2: Request challenge
  async function handleCreateChallenge(e: React.FormEvent) {
    e.preventDefault();
    setWizardError(null);

    if (!inputDomain.trim()) {
      setWizardError("Domain name is required.");
      return;
    }
    if (!address) {
      setWizardError("Publisher wallet must be connected.");
      return;
    }

    try {
      const cleanDomain = inputDomain.trim().toLowerCase();
      const chal = await api.createDnsChallenge(cleanDomain, address);
      setChallenge(chal);
      setWizardStep(2);
    } catch (err: any) {
      setWizardError(err.message || "Failed to create DNS challenge.");
    }
  }

  // Step 2: Verify DNS TXT
  async function handleVerifyDns() {
    if (!challenge) return;
    setIsVerifyingDns(true);
    setWizardError(null);

    try {
      const res = await api.verifyDns(challenge.domain, challenge.id);
      if (res.verified) {
        setDnsVerified(true);
        setWizardStep(3);
      } else {
        setWizardError(
          "DNS TXT record not found yet. DNS changes can take a few minutes to propagate. Please verify record value and retry."
        );
      }
    } catch (err: any) {
      setWizardError(err.message || "DNS verification check failed.");
    } finally {
      setIsVerifyingDns(false);
    }
  }

  // Step 3: Dual Authorization Registration (EIP-712 + Registrar Relay)
  async function handleAuthorizeRegistration() {
    if (!address || !challenge) return;
    setIsSubmittingOnChain(true);
    setWizardError(null);

    try {
      // 1. Fetch publisher nonce
      const nonceData = await api.getPublisherNonce(address);
      const currentNonce = BigInt(nonceData.nonce);

      // 2. Set deadline: 1 hour in the future
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // 3. Request EIP-712 wallet signature
      const sigKey = (initialSigningKey.trim() || address) as `0x${string}`;
      const signature = await signRegistrationAuth({
        domain: challenge.domain,
        publisher: address,
        initialSigningKey: sigKey,
        nonce: currentNonce,
        deadline,
      });

      // 4. Submit to backend registrar
      const reg = await api.registerDomain({
        domain: challenge.domain,
        publisher: address,
        initial_signing_key: sigKey,
        deadline: Number(deadline),
        signature,
      });

      setRegistrationResult(reg);
      setWizardStep(4);
      loadDomains();
    } catch (err: any) {
      setWizardError(err.message || "On-chain domain registration failed.");
    } finally {
      setIsSubmittingOnChain(false);
    }
  }

  function resetWizard() {
    setShowWizard(false);
    setWizardStep(1);
    setInputDomain("");
    setChallenge(null);
    setDnsVerified(false);
    setRegistrationResult(null);
    setWizardError(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Domain Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Cryptographically bind origins to authorized publisher wallets and manage DNS challenge verifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDomains}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh domains"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm shadow-blue-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Domain
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Onboarding Wizard Modal / Panel */}
      {showWizard && (
        <div className="bg-[#0f172a] border border-blue-500/30 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Domain Onboarding Wizard (Dual-Authorization)</h2>
            </div>
            <button
              onClick={resetWizard}
              className="text-xs text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
          </div>

          {/* Stepper Indicator */}
          <div className="flex items-center justify-between max-w-lg mx-auto mb-8 text-xs font-medium">
            <div className={`flex items-center gap-2 ${wizardStep >= 1 ? "text-blue-400" : "text-slate-500"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                wizardStep >= 1 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
              }`}>1</div>
              <span>Origin</span>
            </div>
            <div className={`h-0.5 flex-1 mx-2 ${wizardStep >= 2 ? "bg-blue-600" : "bg-slate-800"}`} />
            <div className={`flex items-center gap-2 ${wizardStep >= 2 ? "text-blue-400" : "text-slate-500"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                wizardStep >= 2 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
              }`}>2</div>
              <span>DNS Challenge</span>
            </div>
            <div className={`h-0.5 flex-1 mx-2 ${wizardStep >= 3 ? "bg-blue-600" : "bg-slate-800"}`} />
            <div className={`flex items-center gap-2 ${wizardStep >= 3 ? "text-blue-400" : "text-slate-500"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                wizardStep >= 3 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
              }`}>3</div>
              <span>Wallet Auth</span>
            </div>
            <div className={`h-0.5 flex-1 mx-2 ${wizardStep >= 4 ? "bg-emerald-400" : "bg-slate-800"}`} />
            <div className={`flex items-center gap-2 ${wizardStep >= 4 ? "text-emerald-400" : "text-slate-500"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                wizardStep >= 4 ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
              }`}>4</div>
              <span>Registered</span>
            </div>
          </div>

          {wizardError && (
            <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {wizardError}
            </div>
          )}

          {/* Step 1: Input Domain */}
          {wizardStep === 1 && (
            <form onSubmit={handleCreateChallenge} className="max-w-md mx-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Website Origin Domain (UTS #46 Canonical)
                </label>
                <input
                  type="text"
                  placeholder="e.g. portal.acme-corp.com"
                  value={inputDomain}
                  onChange={(e) => setInputDomain(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Initial Signing Key EVM Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={initialSigningKey}
                  onChange={(e) => setInitialSigningKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Defaults to connected publisher wallet. Can be rotated later.
                </span>
              </div>

              {!isConnected ? (
                <button
                  type="button"
                  onClick={connectWallet}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 rounded-lg py-2.5 text-xs font-medium transition"
                >
                  Connect Wallet to Proceed
                </button>
              ) : (
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-xs font-medium transition shadow-md shadow-blue-500/20"
                >
                  Generate DNS TXT Challenge →
                </button>
              )}
            </form>
          )}

          {/* Step 2: DNS Challenge Instructions */}
          {wizardStep === 2 && challenge && (
            <div className="max-w-xl mx-auto space-y-5">
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-200">
                  Configure DNS TXT Record at your Domain Registrar / DNS Provider:
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Record Type:</div>
                  <code className="text-xs text-emerald-400 font-mono bg-slate-950 px-2 py-1 rounded">TXT</code>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Host / Record Name:</div>
                  <div className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded font-mono text-xs text-slate-200">
                    <span className="truncate">{challenge.record_name}</span>
                    <button
                      onClick={() => copyText("name", challenge.record_name)}
                      className="text-xs text-blue-400 hover:text-blue-300 ml-2"
                      title="Copy Record Name"
                    >
                      {copiedField === "name" ? "Copied!" : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Record Value:</div>
                  <div className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded font-mono text-xs text-slate-200">
                    <span className="truncate">{challenge.record_value}</span>
                    <button
                      onClick={() => copyText("value", challenge.record_value)}
                      className="text-xs text-blue-400 hover:text-blue-300 ml-2"
                      title="Copy Record Value"
                    >
                      {copiedField === "value" ? "Copied!" : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setWizardStep(1)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  ← Back
                </button>
                <button
                  onClick={handleVerifyDns}
                  disabled={isVerifyingDns}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-5 py-2.5 text-xs font-medium transition shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {isVerifyingDns ? "Querying Nameservers..." : "Verify DNS Record →"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Dual Authorization Signature */}
          {wizardStep === 3 && (
            <div className="max-w-md mx-auto space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">Cryptographic Publisher Authorization</h3>
                <p className="text-xs text-slate-400 mt-1">
                  DNS verification completed. Sign an EIP-712 registration authorization with your connected publisher wallet to finalize binding.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-left font-mono text-xs space-y-1">
                <div className="text-slate-400">Domain: <span className="text-white">{challenge?.domain}</span></div>
                <div className="text-slate-400">Publisher: <span className="text-white">{address}</span></div>
                <div className="text-slate-400">Signing Key: <span className="text-white">{initialSigningKey}</span></div>
                <div className="text-slate-400">Registry: <span className="text-white">{DEPLOYED_CONTRACTS.PublisherRegistry}</span></div>
              </div>

              <button
                onClick={handleAuthorizeRegistration}
                disabled={isSubmittingOnChain}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-xs font-medium transition shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                {isSubmittingOnChain ? "Submitting Registration..." : "Sign EIP-712 & Register On-Chain"}
              </button>
            </div>
          )}

          {/* Step 4: Success */}
          {wizardStep === 4 && registrationResult && (
            <div className="max-w-md mx-auto space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">Domain Successfully Registered!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Origin <span className="text-white font-mono">{registrationResult.domain}</span> is now active in PublisherRegistry.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-left font-mono text-xs space-y-1">
                <div className="text-slate-400">Status: <span className="text-emerald-400 font-bold">{registrationResult.status}</span></div>
                <div className="text-slate-400 truncate">Transaction: <span className="text-white">{registrationResult.transaction_hash}</span></div>
                <div className="text-slate-400 truncate">Initial Key: <span className="text-white">{registrationResult.initial_signing_key}</span></div>
              </div>

              <button
                onClick={resetWizard}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg py-2.5 text-xs font-medium transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}

      {/* Domains Table */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Registered Origins ({domains.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="px-6 py-3">Domain</th>
                <th className="px-6 py-3">Publisher Wallet</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Network</th>
                <th className="px-6 py-3">Transaction</th>
                <th className="px-6 py-3">Registered At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-sans">
                    Loading domain records...
                  </td>
                </tr>
              ) : domains.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-sans">
                    No domains registered yet. Click &ldquo;Add Domain&rdquo; to begin.
                  </td>
                </tr>
              ) : (
                domains.map((d) => (
                  <tr key={d.canonical_domain} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-3.5 font-semibold text-white">{d.canonical_domain}</td>
                    <td className="px-6 py-3.5 text-slate-300">
                      {d.publisher?.wallet_address
                        ? `${d.publisher.wallet_address.slice(0, 8)}...${d.publisher.wallet_address.slice(-6)}`
                        : "—"}
                    </td>
                    <td className="px-6 py-3.5 font-sans">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          d.registration_status === "REGISTERED_ONCHAIN"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {d.registration_status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">Anvil (31337)</td>
                    <td className="px-6 py-3.5 text-slate-400">
                      {d.onchain_registration_transaction ? (
                        <span title={d.onchain_registration_transaction}>
                          {`${d.onchain_registration_transaction.slice(0, 10)}...`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 font-sans">
                      {d.registered_at ? new Date(d.registered_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

