"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "../../../components/WalletProvider";
import { api } from "../../../lib/api";
import { DEPLOYED_CONTRACTS } from "../../../lib/contracts";
import {
  Settings,
  Shield,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Server,
  Cpu,
  Lock,
} from "lucide-react";

export default function SettingsPage() {
  const { address, isConnected, chainId } = useWallet();
  const [backendUrl, setBackendUrl] = useState<string>("http://127.0.0.1:8000");
  const [healthStatus, setHealthStatus] = useState<string>("checking...");
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [savedMsg, setSavedMsg] = useState<boolean>(false);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await api.getHealth();
        setHealthStatus(res.status === "ok" ? "Operational" : "Degraded");
      } catch {
        setHealthStatus("Unreachable");
      }
    }
    checkHealth();
  }, [backendUrl]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">System Settings & Infrastructure</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure API endpoints, inspect blockchain contract topology, and manage security preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backend & Network Configuration */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-sm font-semibold text-white">
            <Server className="w-4 h-4 text-blue-400" />
            Backend Infrastructure
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Django REST Framework Endpoint
              </label>
              <input
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
              <span className="text-slate-400">Health Check Status:</span>
              <span className={`font-mono font-bold uppercase ${
                healthStatus === "Operational" ? "text-emerald-400" : "text-rose-400"
              }`}>
                {healthStatus}
              </span>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition shadow-sm"
              >
                Save Settings
              </button>
              {savedMsg && (
                <span className="ml-3 text-xs text-emerald-400 font-medium">Settings saved!</span>
              )}
            </div>
          </form>
        </div>

        {/* Blockchain Deployment Configuration */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-6 space-y-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-sm font-semibold text-white">
            <Cpu className="w-4 h-4 text-purple-400" />
            Active Blockchain Registry (Anvil Local)
          </div>

          <div className="space-y-3 font-mono">
            <div>
              <span className="text-slate-400 block text-[11px]">Chain ID:</span>
              <span className="text-white font-bold">{DEPLOYED_CONTRACTS.chainId} (Localhost 8545)</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">PublisherRegistry.sol:</span>
              <span className="text-blue-400">{DEPLOYED_CONTRACTS.PublisherRegistry}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">SignatureVerifier.sol:</span>
              <span className="text-blue-400">{DEPLOYED_CONTRACTS.SignatureVerifier}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Ethereum Attestation Service (EAS):</span>
              <span className="text-emerald-400">{DEPLOYED_CONTRACTS.EAS}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">EAS Release Schema UID:</span>
              <span className="text-purple-400 break-all">{DEPLOYED_CONTRACTS.easSchemaUid}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy and Cryptographic Guarantees */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-6 space-y-3 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <Lock className="w-4 h-4 text-emerald-400" />
          Cryptographic Governance Guarantees
        </div>
        <p className="leading-relaxed">
          LUCENTRA enforces zero server-side private key retention. Publisher signing keys and domain authorization credentials never leave your browser wallet. Release integrity is attested on-chain via the Ethereum Attestation Service (EAS) and verified out-of-band by browser clients.
        </p>
      </div>
    </div>
  );
}

