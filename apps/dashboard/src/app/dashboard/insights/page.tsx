"use client";

import React, { useEffect, useState } from "react";
import { api, DomainRecord, AIExplanationResult } from "../../../lib/api";
import {
  Sparkles,
  Shield,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Terminal,
  Activity,
} from "lucide-react";

export default function InsightsPage() {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [explanation, setExplanation] = useState<AIExplanationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tamper simulation mode
  const [simulatedTamper, setSimulatedTamper] = useState<boolean>(false);

  useEffect(() => {
    async function fetchDomains() {
      try {
        const list = await api.listDomains();
        setDomains(list);
        if (list.length > 0) {
          setSelectedDomain(list[0].canonical_domain);
        }
      } catch (err) {
        console.warn("Could not fetch domains:", err);
      }
    }
    fetchDomains();
  }, []);

  async function generateExplanation(isTamper = false) {
    if (!selectedDomain) return;
    setLoading(true);
    setError(null);

    try {
      if (isTamper) {
        // Trigger simulated tamper scenario
        const res = await api.getAiExplanation({
          domain: selectedDomain,
          verification_state: "UNVERIFIED_RESOURCE_DETECTED",
          publisher_registered: true,
          release_version: "1.0.0",
          sequence: 1,
          resource_discrepancies: [
            {
              path: "/static/js/checkout.bundle.js",
              status: "MISMATCH",
              expected_hash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
              observed_hash: "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
            },
          ],
          has_inline_scripts: false,
          observation_completeness: "COMPLETE",
          force_refresh: true,
        });
        setExplanation(res);
      } else {
        // Normal domain evaluation
        const res = await api.getDomainAiExplanation(selectedDomain);
        setExplanation(res);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate AI security explanation.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedDomain) {
      generateExplanation(simulatedTamper);
    }
  }, [selectedDomain, simulatedTamper]);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "LOW":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "MEDIUM":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "HIGH":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "CRITICAL":
        return "bg-red-600/20 text-red-400 border-red-500/40";
      default:
        return "bg-slate-700 text-slate-300 border-slate-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-400" />
            Security Insights & Gemini Copilot
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Plain-English cryptographic telemetry interpretation, threat modeling, and recommended remediation actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {domains.length > 0 && (
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-blue-500"
            >
              {domains.map((d) => (
                <option key={d.canonical_domain} value={d.canonical_domain}>
                  {d.canonical_domain}
                </option>
              ))}
            </select>
          )}

          {/* Tamper Simulation Toggle */}
          <button
            onClick={() => setSimulatedTamper(!simulatedTamper)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
              simulatedTamper
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            {simulatedTamper ? "⚠️ Tamper Simulation: ACTIVE" : "Simulate Resource Tamper"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Explainer Result Card */}
      {loading ? (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400 space-y-3">
          <Sparkles className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
          <p>Analyzing cryptographic verification evidence with Google Gemini...</p>
        </div>
      ) : explanation ? (
        <div className="space-y-6">
          {/* Main Headline & Risk Level */}
          <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-full uppercase">
                  Google Gemini AI
                </span>
                <span className="font-mono text-xs text-slate-400">{explanation.deterministic_state}</span>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase ${getRiskBadge(explanation.risk_level)}`}>
                {explanation.risk_level} Risk
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-white">{explanation.headline}</h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {explanation.detailed_explanation}
              </p>
            </div>
          </div>

          {/* Technical Discrepancies and Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Terminal className="w-4 h-4 text-amber-400" />
                Technical Discrepancy Breakdown
              </div>
              <p className="text-xs text-slate-300 font-mono bg-slate-900/80 p-3 rounded-lg border border-slate-800 leading-relaxed">
                {explanation.technical_discrepancy_summary}
              </p>
            </div>

            <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Shield className="w-4 h-4 text-emerald-400" />
                Recommended Investigation & Action
              </div>
              <p className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-800 leading-relaxed">
                {explanation.recommended_action}
              </p>
            </div>
          </div>

          {/* Provenance & Limitations */}
          <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-6 space-y-3 text-xs text-slate-400">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[11px]">
              <span>Model ID: <strong className="text-slate-300 font-mono">{explanation.model_id}</strong></span>
              <span>Generated: <strong className="text-slate-300 font-mono">{new Date(explanation.generated_at).toLocaleString()}</strong></span>
            </div>
            <div className="text-[11px] leading-relaxed text-slate-400 italic">
              <strong>Limitations Disclosure: </strong>
              {explanation.limitations}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-500">
          Select a domain above to view AI-generated security telemetry insights.
        </div>
      )}
    </div>
  );
}

