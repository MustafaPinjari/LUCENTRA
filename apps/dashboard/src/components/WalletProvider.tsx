"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  createWalletClient,
  custom,
  createPublicClient,
  http,
  type WalletClient,
  type PublicClient,
  type Hex,
  type Address,
  getAddress,
} from "viem";
import {
  DEPLOYED_CONTRACTS,
  PUBLISHER_REGISTRY_ABI,
  createLucentraDomain,
  REGISTRATION_AUTHORIZATION_EIP712_TYPES,
  REGISTRATION_AUTHORIZATION_PRIMARY_TYPE,
  RELEASE_MANIFEST_EIP712_TYPES,
  RELEASE_MANIFEST_PRIMARY_TYPE,
  buildReleaseManifestMessage,
} from "../lib/contracts";

interface WalletContextType {
  address: Address | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  signRegistrationAuth: (params: {
    domain: string;
    publisher: Address;
    initialSigningKey: Address;
    nonce: bigint;
    deadline: bigint;
  }) => Promise<Hex>;
  signReleaseManifest: (params: {
    manifest: any;
    manifestHash: Hex;
  }) => Promise<Hex>;
  authorizeKeyOnChain: (domain: string, key: Address) => Promise<Hex>;
  revokeKeyOnChain: (domain: string, key: Address) => Promise<Hex>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const eth = (window as any).ethereum;

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(getAddress(accounts[0]));
        } else {
          setAddress(null);
        }
      };

      const handleChainChanged = (chainHex: string) => {
        setChainId(parseInt(chainHex, 16));
      };

      eth.on?.("accountsChanged", handleAccountsChanged);
      eth.on?.("chainChanged", handleChainChanged);

      return () => {
        eth.removeListener?.("accountsChanged", handleAccountsChanged);
        eth.removeListener?.("chainChanged", handleChainChanged);
      };
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setError("No Ethereum browser wallet (e.g. MetaMask) detected. Please install a Web3 wallet.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const eth = (window as any).ethereum;
      const client = createWalletClient({
        transport: custom(eth),
      });

      const [acc] = await client.requestAddresses();
      const currentChainId = await eth.request({ method: "eth_chainId" });

      setAddress(getAddress(acc));
      setChainId(parseInt(currentChainId, 16));
      setWalletClient(client);
    } catch (err: any) {
      setError(err?.message || "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setChainId(null);
    setWalletClient(null);
    setError(null);
  };

  const signRegistrationAuth = async (params: {
    domain: string;
    publisher: Address;
    initialSigningKey: Address;
    nonce: bigint;
    deadline: bigint;
  }): Promise<Hex> => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    const domainSeparator = createLucentraDomain(
      chainId || DEPLOYED_CONTRACTS.chainId,
      DEPLOYED_CONTRACTS.PublisherRegistry
    );

    const signature = await walletClient.signTypedData({
      account: address,
      domain: domainSeparator as any,
      types: REGISTRATION_AUTHORIZATION_EIP712_TYPES as any,
      primaryType: REGISTRATION_AUTHORIZATION_PRIMARY_TYPE,
      message: {
        domain: params.domain,
        publisher: params.publisher,
        initialSigningKey: params.initialSigningKey,
        nonce: params.nonce,
        deadline: params.deadline,
      },
    });

    return signature;
  };

  const signReleaseManifest = async (params: {
    manifest: any;
    manifestHash: Hex;
  }): Promise<Hex> => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    const domainSeparator = createLucentraDomain(
      chainId || DEPLOYED_CONTRACTS.chainId,
      DEPLOYED_CONTRACTS.SignatureVerifier
    );

    const message = buildReleaseManifestMessage(params.manifest, params.manifestHash);

    const signature = await walletClient.signTypedData({
      account: address,
      domain: domainSeparator as any,
      types: RELEASE_MANIFEST_EIP712_TYPES as any,
      primaryType: RELEASE_MANIFEST_PRIMARY_TYPE,
      message: message as any,
    });

    return signature;
  };

  const authorizeKeyOnChain = async (domain: string, key: Address): Promise<Hex> => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    const hash = await walletClient.writeContract({
      account: address,
      address: DEPLOYED_CONTRACTS.PublisherRegistry,
      abi: PUBLISHER_REGISTRY_ABI,
      functionName: "authorizeKey",
      args: [domain, key],
      chain: undefined,
    });

    return hash;
  };

  const revokeKeyOnChain = async (domain: string, key: Address): Promise<Hex> => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    const hash = await walletClient.writeContract({
      account: address,
      address: DEPLOYED_CONTRACTS.PublisherRegistry,
      abi: PUBLISHER_REGISTRY_ABI,
      functionName: "revokeKey",
      args: [domain, key],
      chain: undefined,
    });

    return hash;
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isConnected: !!address,
        isConnecting,
        error,
        connectWallet,
        disconnectWallet,
        signRegistrationAuth,
        signReleaseManifest,
        authorizeKeyOnChain,
        revokeKeyOnChain,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}

