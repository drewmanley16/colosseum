import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "APPL — Agent Permissions & Policy Layer",
  description:
    "Programmable onchain policies for autonomous AI agents on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)", color: "var(--ink)" }}>
        <WalletContextProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: { background: "var(--bg-card)", color: "var(--ink)", border: "1px solid var(--border)" },
            }}
          />
        </WalletContextProvider>
      </body>
    </html>
  );
}
