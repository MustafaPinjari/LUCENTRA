"use client";

import React, { useEffect, useState } from "react";
import { api, ReleaseRecord, DomainRecord } from "../../../lib/api";
import {
  History,
  Shield,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

export default function VerificationPage() {
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  async function loadData() {
    setLoading(true);
    try {
      const [rList, dList] = await Promise.all([
        api.listReleases(),
        api.listDomains(),
      ]);
      setReleases(rList);
      setDomains(dList);
    } catch (err) {
      console.error("Verification history fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Verification History & Evidence</h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit trail of verified cryptographic release envelopes, on-chain EAS attestations, and domain binding states.
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* History Table */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Attested Manifest Records ({releases.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="px-6 py-3">Origin</th>
                <th className="px-6 py-3">Release Version</th>
                <th className="px-6 py-3">Attestation UID</th>
                <th className="px-6 py-3">Resource Count</th>
                <th className="px-6 py-3">Attestation Status</th>
                <th className="px-6 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-sans">
                    Loading verification events...
                  </td>
                </tr>
              ) : releases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-sans">
                    No verification records logged yet. Attested releases will appear here automatically.
                  </td>
                </tr>
              ) : (
                releases.map((r) => {
                  const resourceCount = r.manifest_json?.resources
                    ? Object.keys(r.manifest_json.resources).length
                    : 1;

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-6 py-3.5 font-semibold text-white">{r.domain}</td>
                      <td className="px-6 py-3.5 text-blue-400">v{r.version}</td>
                      <td className="px-6 py-3.5 text-purple-400" title={r.attestation_uid || ""}>
                        {r.attestation_uid ? `${r.attestation_uid.slice(0, 12)}...` : "—"}
                      </td>
                      <td className="px-6 py-3.5 text-slate-300">{resourceCount} external script(s)</td>
                      <td className="px-6 py-3.5 font-sans">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-400 font-sans">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

