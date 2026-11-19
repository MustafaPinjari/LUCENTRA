"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "../../../components/WalletProvider";
import { api } from "../../../lib/api";
import { DEPLOYED_CONTRACTS } from "../../../lib/contracts";
import {
  Wallet,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
} from "lucide-react";

export default function IdentityPage() {
  const { address, isConnected, isConnecting, connectWallet, disconnectWallet, chainId } = useWallet();
  const [nonce, setNonce] = useState<number | null>(null);
  const [loadingNonce, setLoadingNonce] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function fetchNonce() {
      if (!address) {
        setNonce(null);
        return;
      }
      setLoadingNonce(true);
      try {
        const res = await api.getPublisherNonce(address);
        setNonce(res.nonce);
      } catch (err) {
        console.warn("Could not fetch publisher nonce:", err);
      } finally {
        setLoadingNonce(false);
      }
    }
    fetchNonce();
  }, [address]);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isCorrectChain = chainId === DEPLOYED_CONTRACTS.chainId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">Publisher Identity & Wallet</h1>
        <p className="text-xs text-slate-400 mt-1">
          Cryptographic wallet identity management, on-chain registration nonces, and EIP-712 session authorization.
        </p>
      </div>

      {/* Network Warning Banner */}
      {isConnected && !isCorrectChain && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Wrong Network Detected: </span>
              Your wallet is connected to Chain ID {chainId}. The current development registry operates on Chain ID {DEPLOYED_CONTRACTS.chainId} (Anvil Local).
            </div>
          </div>
        </div>
      )}

      {/* Identity Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-[#0f172a] border border-slate-800/80 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Connected Publisher Signer</h2>
            </div>
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                Disconnected
              </span>
            )}
          </div>

          {isConnected && address ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  EVM Account Address
                </label>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 font-mono text-xs text-white">
                  <span>{address}</span>
                  <button
                    onClick={copyAddress}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {copied ? "Copied!" : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400">Current Chain ID</div>
                  <div className="text-sm font-bold font-mono text-white mt-1">
                    {chainId || "Unknown"}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400">On-Chain Registration Nonce</div>
                  <div className="text-sm font-bold font-mono text-emerald-400 mt-1">
                    {loadingNonce ? "..." : nonce !== null ? nonce : "0"}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={disconnectWallet}
                  className="px-4 py-2 bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-slate-700 hover:border-rose-500/30 rounded-lg text-xs font-medium transition"
                >
                  Disconnect Wallet
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-3">
              <Wallet className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Connect your browser Web3 wallet to authorize publisher domains, issue release signatures, and manage signing keys.
              </p>
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-5 py-2.5 rounded-lg shadow-sm shadow-blue-500/20 transition disabled:opacity-50"
              >
                <Wallet className="w-4 h-4" />
                {isConnecting ? "Connecting..." : "Connect Web3 Wallet"}
              </button>
            </div>
          )}
        </div>

        {/* Security Disclosures */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-6 space-y-4">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Identity Architecture
          </h3>
          <ul className="text-xs text-slate-400 space-y-3">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">•</span>
              <span>
                <strong className="text-slate-300">Zero Backend Private Keys: </strong>
                Your private keys remain exclusively in your wallet software. The backend never receives or stores signing keys.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">•</span>
              <span>
                <strong className="text-slate-300">Dual Authorization: </strong>
                Domain registrations require both off-chain DNS TXT validation and your wallet EIP-712 signature.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">•</span>
              <span>
                <strong className="text-slate-300">Replay Protection: </strong>
                Nonces prevent registration intent reuse across different domains or chains.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

