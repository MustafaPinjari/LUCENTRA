import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "../components/WalletProvider";
import { Navigation } from "../components/Navigation";

export const metadata: Metadata = {
  title: "LUCENTRA Dashboard — Trust, made verifiable.",
  description: "Publisher Dashboard for cryptographic release manifests, domain authorization, and EAS attestations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080c14] text-slate-100">
        <WalletProvider>
          <Navigation>{children}</Navigation>
        </WalletProvider>
      </body>
    </html>
  );
}

