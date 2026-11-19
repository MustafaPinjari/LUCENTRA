"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "../../../components/WalletProvider";
import { api, DomainRecord, SigningKeyRecord } from "../../../lib/api";
import {
  Key,
  Plus,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  RotateCw,
} from "lucide-react";

export default function KeysPage() {
  const { address, isConnected, connectWallet, authorizeKeyOnChain, revokeKeyOnChain } = useWallet();
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [keys, setKeys] = useState<SigningKeyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Authorize new key modal
  const [showAddKey, setShowAddKey] = useState<boolean>(false);
  const [newKeyAddress, setNewKeyAddress] = useState<string>("");

  useEffect(() => {
    async function fetchDomains() {
      try {
        const list = await api.listDomains();
        const registered = list.filter((d) => d.registration_status === "REGISTERED_ONCHAIN");
        setDomains(registered);
        if (registered.length > 0) {
          setSelectedDomain(registered[0].canonical_domain);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load domains");
      } finally {
        setLoading(false);
      }
    }
    fetchDomains();
  }, []);

  async function loadKeysForDomain(domain: string) {
    if (!domain) return;
    setLoading(true);
    try {
      const kList = await api.listDomainKeys(domain);
      setKeys(kList);
    } catch (err: any) {
      console.warn("Could not load keys:", err);
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedDomain) {
      loadKeysForDomain(selectedDomain);
    }
  }, [selectedDomain]);

  async function handleAuthorizeKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyAddress.trim() || !selectedDomain) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const cleanKey = newKeyAddress.trim() as `0x${string}`;
      // 1. Authorize on-chain through connected domain owner wallet
      const txHash = await authorizeKeyOnChain(selectedDomain, cleanKey);
      // 2. Reconcile with backend
      await api.reconcileDomain(selectedDomain, cleanKey);

      setSuccessMsg(`Signing key ${cleanKey} successfully authorized! Transaction: ${txHash}`);
      setNewKeyAddress("");
      setShowAddKey(false);
      loadKeysForDomain(selectedDomain);
    } catch (err: any) {
      setError(err.message || "Key authorization failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevokeKey(keyAddress: string) {
    if (!selectedDomain) return;
    if (!confirm(`Are you sure you want to revoke signing key ${keyAddress}? Releases signed after revocation will not be accepted.`)) {
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const cleanKey = keyAddress as `0x${string}`;
      const txHash = await revokeKeyOnChain(selectedDomain, cleanKey);
      await api.reconcileDomain(selectedDomain);

      setSuccessMsg(`Signing key ${cleanKey} revoked on-chain! Transaction: ${txHash}`);
      loadKeysForDomain(selectedDomain);
    } catch (err: any) {
      setError(err.message || "Key revocation failed");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Signing Key Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Authorize, inspect, and revoke operational release signing keys bound to registered domains.
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

          <button
            onClick={() => setShowAddKey(true)}
            disabled={!selectedDomain || !isConnected}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm shadow-blue-500/20 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Authorize Key
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Authorize Key Modal */}
      {showAddKey && (
        <div className="bg-[#0f172a] border border-blue-500/30 rounded-xl p-6 shadow-xl max-w-lg mx-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" />
              Authorize New Signing Key on {selectedDomain}
            </h3>
            <button onClick={() => setShowAddKey(false)} className="text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>

          <form onSubmit={handleAuthorizeKey} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                New Operational Signing Key Address (0x...)
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={newKeyAddress}
                onChange={(e) => setNewKeyAddress(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                The transaction will be sent from your connected domain owner wallet to PublisherRegistry.sol.
              </span>
            </div>

            <button
              type="submit"
              disabled={actionLoading || !newKeyAddress.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-xs font-medium transition disabled:opacity-50"
            >
              {actionLoading ? "Submitting on-chain..." : "Submit Key Authorization"}
            </button>
          </form>
        </div>
      )}

      {/* Keys Table */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Authorized Keys for {selectedDomain || "Origin"} ({keys.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="px-6 py-3">Signing Key Address</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Authorized At</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-sans">
                    Loading signing keys...
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-sans">
                    No signing keys authorized yet for {selectedDomain}.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.public_address} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-3.5 font-semibold text-white">{k.public_address}</td>
                    <td className="px-6 py-3.5 font-sans">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          k.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {k.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 font-sans">
                      {new Date(k.authorized_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-right font-sans">
                      {k.status === "ACTIVE" && (
                        <button
                          onClick={() => handleRevokeKey(k.public_address)}
                          disabled={actionLoading}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-[11px] font-medium transition disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      )}
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

