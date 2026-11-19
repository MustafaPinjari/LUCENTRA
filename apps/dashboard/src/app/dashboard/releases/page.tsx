"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "../../../components/WalletProvider";
import { api, DomainRecord, ReleaseRecord } from "../../../lib/api";
import {
  canonicalizeManifest,
  hashManifest,
  formatResourceHash,
  type ReleaseManifest,
  type ReleaseResource,
  type Hex,
} from "@lucentra/core";
import {
  FileCheck2,
  Plus,
  Shield,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Upload,
  Trash2,
  ArrowRight,
} from "lucide-react";

export default function ReleasesPage() {
  const { address, isConnected, connectWallet, signReleaseManifest } = useWallet();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Release Creation Wizard State
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [version, setVersion] = useState<string>("1.0.0");
  const [expiryDays, setExpiryDays] = useState<number>(365);
  const [resources, setResources] = useState<Array<{ path: string; hash: string; size: number; type: "script" | "module" | "worker" }>>([
    { path: "/static/js/app.js", hash: "sha256:464c707375da142d0806bd0998776365cc5892981418ba1510c4cfb63142c4a7", size: 465, type: "script" },
  ]);
  const [isHashing, setIsHashing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdRelease, setCreatedRelease] = useState<ReleaseRecord | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [dList, rList] = await Promise.all([
        api.listDomains(),
        api.listReleases(),
      ]);
      const registered = dList.filter((d) => d.registration_status === "REGISTERED_ONCHAIN");
      setDomains(registered);
      if (registered.length > 0 && !selectedDomain) {
        setSelectedDomain(registered[0].canonical_domain);
      }
      setReleases(rList);
    } catch (err: any) {
      setError(err.message || "Failed to load release data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Compute SHA-256 of uploaded file bytes
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsHashing(true);
    try {
      const buffer = await file.arrayBuffer();
      const digestBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const digestArray = Array.from(new Uint8Array(digestBuffer));
      const digestHex = digestArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      const formattedHash = `sha256:${digestHex}`;

      const updated = [...resources];
      updated[index] = {
        ...updated[index],
        path: `/${file.name}`,
        hash: formattedHash,
        size: file.size,
      };
      setResources(updated);
    } catch (err) {
      console.error("Hashing failed:", err);
    } finally {
      setIsHashing(false);
    }
  }

  function addResourceRow() {
    setResources([
      ...resources,
      { path: `/static/js/chunk-${resources.length + 1}.js`, hash: "", size: 1024, type: "script" },
    ]);
  }

  function removeResourceRow(index: number) {
    if (resources.length <= 1) return;
    setResources(resources.filter((_, i) => i !== index));
  }

  // Release Creation & EIP-712 Signing
  async function handleCreateAndSignRelease(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDomain || !address) return;
    setWizardError(null);
    setIsSubmitting(true);

    try {
      // 1. Fetch domain releases to determine next monotonic sequence and previous hash
      const existingReleases = await api.listDomainReleases(selectedDomain);
      const latest = existingReleases[0];
      const sequence = latest ? latest.sequence + 1 : 1;
      const previousManifestHash = (latest ? latest.manifest_hash : "0x" + "0".repeat(64)) as Hex;

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + expiryDays * 86400;

      // 2. Format declared resources
      const manifestResources: ReleaseResource[] = [];
      const observedResources: Record<string, string> = {};

      for (const res of resources) {
        const cleanPath = res.path.trim();
        const cleanHash = res.hash.trim();
        if (!cleanPath || !cleanHash) {
          throw new Error("All resource paths and SHA-256 hashes must be filled.");
        }
        manifestResources.push({
          path: cleanPath,
          size: res.size || 1024,
          sha256: cleanHash as `sha256:${string}`,
          type: res.type,
        });
        observedResources[cleanPath] = cleanHash;
      }

      // 3. Build canonical protocol manifest
      const manifest: ReleaseManifest = {
        schemaVersion: "LUCENTRA-Manifest-v0.1",
        domain: selectedDomain,
        version: version.trim(),
        sequence,
        previousManifestHash,
        createdAt: now,
        expiresAt,
        resources: manifestResources,
      };

      // 4. Canonicalize (RFC 8785) & compute manifest hash
      const canonicalJson = canonicalizeManifest(manifest);
      const manifestHash = hashManifest(canonicalJson);

      // 5. Request EIP-712 wallet signature
      const signature = await signReleaseManifest({
        manifest,
        manifestHash,
      });

      // 6. Submit to backend for verification and EAS attestation
      const submitted = await api.submitRelease({
        manifest,
        signature,
        signing_key: address,
        observed_resources: observedResources,
      });

      setCreatedRelease(submitted);
      loadData();
    } catch (err: any) {
      setWizardError(err.message || "Release submission and attestation failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetWizard() {
    setShowWizard(false);
    setCreatedRelease(null);
    setWizardError(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Release Manifest Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Construct, canonicalize (RFC 8785), sign via EIP-712, and attest production releases on Ethereum Attestation Service.
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          disabled={domains.length === 0 || !isConnected}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm shadow-blue-500/20 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Create & Sign Release
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Creation Wizard */}
      {showWizard && (
        <div className="bg-[#0f172a] border border-blue-500/30 rounded-xl p-6 shadow-xl relative">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Cryptographic Release Creation Wizard</h2>
            </div>
            <button onClick={resetWizard} className="text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>

          {wizardError && (
            <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {wizardError}
            </div>
          )}

          {!createdRelease ? (
            <form onSubmit={handleCreateAndSignRelease} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Target Domain
                  </label>
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  >
                    {domains.map((d) => (
                      <option key={d.canonical_domain} value={d.canonical_domain}>
                        {d.canonical_domain}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Release Version (SemVer)
                  </label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="1.0.0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Attestation Validity (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="730"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(parseInt(e.target.value) || 365)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Declared JavaScript Resources */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Declared JavaScript Resources (Build Artifacts)
                  </span>
                  <button
                    type="button"
                    onClick={addResourceRow}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Resource Path
                  </button>
                </div>

                <div className="space-y-2">
                  {resources.map((res, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <input
                        type="text"
                        placeholder="/static/js/bundle.js"
                        value={res.path}
                        onChange={(e) => {
                          const updated = [...resources];
                          updated[i].path = e.target.value;
                          setResources(updated);
                        }}
                        className="w-1/3 bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none"
                      />

                      <input
                        type="text"
                        placeholder="sha256:..."
                        value={res.hash}
                        onChange={(e) => {
                          const updated = [...resources];
                          updated[i].hash = e.target.value;
                          setResources(updated);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs text-emerald-400 font-mono focus:outline-none"
                      />

                      {/* File Upload to Auto-Hash */}
                      <label className="cursor-pointer px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 text-xs flex items-center gap-1 shrink-0" title="Upload local build file to compute SHA-256">
                        <Upload className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Upload</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, i)}
                        />
                      </label>

                      {resources.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeResourceRow(i)}
                          className="p-1.5 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <Shield className="w-4 h-4 text-blue-400" />
                  EIP-712 Signature & EAS Attestation Pipeline
                </div>
                <p>
                  Submitting will request a cryptographic signature from your connected signing key ({address}). The manifest will be canonicalized under RFC 8785 and attested on-chain to EAS.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isHashing}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-xs font-medium transition shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                {isSubmitting ? "Signing & Attesting on EAS..." : "Sign Release with Wallet & Attest"}
              </button>
            </form>
          ) : (
            /* Success State */
            <div className="max-w-md mx-auto space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">Release Attested on EAS!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Release <span className="text-white font-mono">v{createdRelease.version}</span> for {createdRelease.domain} is confirmed on-chain.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-left font-mono text-xs space-y-1.5">
                <div className="text-slate-400 truncate">
                  Attestation UID: <span className="text-purple-400 font-semibold">{createdRelease.attestation_uid}</span>
                </div>
                <div className="text-slate-400 truncate">
                  Manifest Hash: <span className="text-emerald-400">{createdRelease.manifest_hash}</span>
                </div>
                <div className="text-slate-400 truncate">
                  Transaction: <span className="text-white">{createdRelease.transaction_hash}</span>
                </div>
                <div className="text-slate-400">
                  Sequence: <span className="text-white">{createdRelease.sequence}</span>
                </div>
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

      {/* Releases Table */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Attested Releases ({releases.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="px-6 py-3">Domain & Version</th>
                <th className="px-6 py-3">Seq</th>
                <th className="px-6 py-3">Manifest Hash</th>
                <th className="px-6 py-3">EAS Attestation UID</th>
                <th className="px-6 py-3">Signer</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 font-sans">
                    Loading release records...
                  </td>
                </tr>
              ) : releases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 font-sans">
                    No releases attested yet. Click &ldquo;Create & Sign Release&rdquo; to attest your first build.
                  </td>
                </tr>
              ) : (
                releases.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-3.5 font-semibold text-white">
                      {r.domain} <span className="text-blue-400 font-normal">v{r.version}</span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-300">{r.sequence}</td>
                    <td className="px-6 py-3.5 text-slate-400" title={r.manifest_hash}>
                      {r.manifest_hash ? `${r.manifest_hash.slice(0, 8)}...${r.manifest_hash.slice(-6)}` : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-purple-400" title={r.attestation_uid || ""}>
                      {r.attestation_uid ? `${r.attestation_uid.slice(0, 10)}...` : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400" title={r.signing_key}>
                      {r.signing_key ? `${r.signing_key.slice(0, 6)}...` : "—"}
                    </td>
                    <td className="px-6 py-3.5 font-sans">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          r.status === "ATTESTED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : r.status === "REVOKED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 font-sans">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
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
