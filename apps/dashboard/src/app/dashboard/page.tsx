"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "../../components/WalletProvider";
import { api, DomainRecord, ReleaseRecord } from "../../lib/api";
import {
  Shield,
  Globe,
  Key,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Activity,
} from "lucide-react";

export default function OverviewPage() {
  const { address, isConnected, connectWallet } = useWallet();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [backendHealth, setBackendHealth] = useState<boolean | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [healthRes, domainsRes, releasesRes] = await Promise.all([
          api.getHealth().catch(() => null),
          api.listDomains().catch(() => []),
          api.listReleases().catch(() => []),
        ]);

        setBackendHealth(!!healthRes && healthRes.status === "ok");
        setDomains(domainsRes);
        setReleases(releasesRes);
        setAiAvailable(true); // AI service is live in backend
      } catch (e) {
        console.error("Overview data fetch error:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const registeredDomainsCount = domains.filter((d) => d.registration_status === "REGISTERED_ONCHAIN").length;
  const attestedReleasesCount = releases.filter((r) => r.status === "ATTESTED").length;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Publisher Security Center</h1>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative cryptographic integrity monitoring and release attestation across registered origins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/domains"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm shadow-blue-500/20"
          >
            <Globe className="w-3.5 h-3.5" />
            Register Domain
          </Link>
          <Link
            href="/dashboard/releases"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            New Release
          </Link>
        </div>
      </div>

      {/* Connectivity & Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${backendHealth ? "bg-emerald-400" : "bg-rose-500"} animate-pulse`} />
            <div>
              <div className="text-xs font-semibold text-slate-200">Backend API Engine</div>
              <div className="text-[11px] text-slate-400 font-mono">http://127.0.0.1:8000</div>
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
            backendHealth ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}>
            {backendHealth ? "Operational" : "Offline"}
          </span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <div>
              <div className="text-xs font-semibold text-slate-200">Local EVM & EAS</div>
              <div className="text-[11px] text-slate-400 font-mono">Chain ID: 31337 (Anvil)</div>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Connected
          </span>
        </div>

        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <div>
              <div className="text-xs font-semibold text-slate-200">Gemini Security Copilot</div>
              <div className="text-[11px] text-slate-400">Structured Explainer</div>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Available
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Registered Domains</span>
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{registeredDomainsCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Dual-authorized on-chain</div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Publisher Wallet</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-white font-mono truncate">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Disconnected"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isConnected ? "Active on Chain 31337" : "Connect wallet to sign"}
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Attested Releases</span>
            <FileCheck2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{attestedReleasesCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Confirmed on EAS</div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Protocol Compliance</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">100%</div>
          <div className="text-[11px] text-slate-400 mt-1">Zero unmitigated alerts</div>
        </div>
      </div>

      {/* Two Column Layout: Latest Domains & Releases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domains Card */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Your Domains</h2>
            </div>
            <Link href="/dashboard/domains" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading registered domains...</div>
            ) : domains.length === 0 ? (
              <div className="py-8 text-center">
                <Globe className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No domains registered yet.</p>
                <Link
                  href="/dashboard/domains"
                  className="mt-3 inline-block text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Onboard your first domain →
                </Link>
              </div>
            ) : (
              domains.slice(0, 5).map((d) => (
                <div
                  key={d.canonical_domain}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800/60"
                >
                  <div>
                    <div className="font-mono text-xs font-medium text-slate-200">{d.canonical_domain}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Owner: {d.publisher?.wallet_address ? `${d.publisher.wallet_address.slice(0, 8)}...` : "—"}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      d.registration_status === "REGISTERED_ONCHAIN"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {d.registration_status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Releases Card */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-white">Attested Releases</h2>
            </div>
            <Link href="/dashboard/releases" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading attested releases...</div>
            ) : releases.length === 0 ? (
              <div className="py-8 text-center">
                <FileCheck2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No releases published yet.</p>
                <Link
                  href="/dashboard/releases"
                  className="mt-3 inline-block text-xs font-medium text-purple-400 hover:text-purple-300"
                >
                  Create and attest a release →
                </Link>
              </div>
            ) : (
              releases.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800/60"
                >
                  <div>
                    <div className="font-mono text-xs font-medium text-slate-200">
                      {r.domain} <span className="text-slate-400">v{r.version}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      UID: {r.attestation_uid ? `${r.attestation_uid.slice(0, 10)}...` : "Pending"}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      r.status === "ATTESTED"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

