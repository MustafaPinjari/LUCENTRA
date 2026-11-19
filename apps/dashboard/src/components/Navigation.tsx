"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./WalletProvider";
import {
  Shield,
  Globe,
  Key,
  FileCheck2,
  History,
  Sparkles,
  Settings,
  Wallet,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/domains", label: "Domain Management", icon: Globe },
  { href: "/dashboard/identity", label: "Publisher Identity", icon: Wallet },
  { href: "/dashboard/keys", label: "Signing Keys", icon: Key },
  { href: "/dashboard/releases", label: "Release Management", icon: FileCheck2 },
  { href: "/dashboard/verification", label: "Verification History", icon: History },
  { href: "/dashboard/insights", label: "Security Insights (AI)", icon: Sparkles },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Navigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, isConnected, isConnecting, connectWallet, disconnectWallet, chainId } = useWallet();

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="flex h-screen bg-[#080c14] text-slate-100 antialiased overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/80 bg-[#0c1220] flex flex-col justify-between shrink-0">
        <div>
          {/* Brand */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
              L
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                LUCENTRA
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  v0.1.0
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Trust, made verifiable.</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 mt-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Network & Protocol Status */}
        <div className="p-4 border-t border-slate-800/80 bg-[#090e1a]/60">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Anvil Local (31337)
            </span>
            <span className="text-emerald-400 font-mono text-[10px]">SYNCED</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            EAS: 0xe7f1...0512
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800/80 bg-[#0c1220]/70 backdrop-blur px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Publisher Governance Dashboard
            </span>
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center gap-3">
            {isConnected && address ? (
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-slate-200">{truncate(address)}</span>
                <button
                  onClick={disconnectWallet}
                  className="ml-2 text-[10px] font-semibold text-slate-400 hover:text-rose-400 transition"
                  title="Disconnect"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-sm shadow-blue-500/20 transition disabled:opacity-50"
              >
                <Wallet className="w-3.5 h-3.5" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#080c14]">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

