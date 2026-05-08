"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export default function Home() {
  const { connected } = useWallet();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-gray-950 to-gray-950 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center max-w-3xl"
      >
        <div className="inline-flex items-center gap-2 bg-violet-950/60 border border-violet-500/30 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          Colosseum Frontier Hackathon
        </div>

        <h1 className="text-6xl font-bold tracking-tight mb-4">
          <span className="text-white">APPL</span>
          <span className="text-violet-400">.</span>
        </h1>
        <p className="text-xl text-gray-400 mb-3 font-mono">
          Agent Permissions &amp; Policy Layer
        </p>
        <p className="text-base text-gray-500 mb-12 max-w-xl mx-auto leading-relaxed">
          Programmable onchain policies for autonomous AI agents on Solana.
          Define exactly what your agents can spend — enforced at the protocol
          level, not the application layer.
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {[
            "Daily spend limits",
            "Approved merchants",
            "Expiry enforcement",
            "Immutable audit log",
          ].map((f) => (
            <span
              key={f}
              className="text-sm px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300"
            >
              {f}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <WalletMultiButton className="!bg-violet-600 hover:!bg-violet-500 !rounded-lg !font-medium !transition-colors" />
          {connected && (
            <Link
              href="/dashboard"
              className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Open Dashboard →
            </Link>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="relative z-10 mt-24 font-mono text-xs text-gray-600 text-left"
      >
        <pre className="bg-gray-900/60 border border-gray-800 rounded-xl px-8 py-6 leading-6">
          {`User Wallet ──► [ PolicyAccount PDA ]
                         │ max 0.1 SOL/day
                         │ approved: WeatherBot
                         │ expires: +24h
                         ▼
Agent Wallet ──► execute_constrained_payment()
                         │
                 ┌────────────┐
                 │  APPROVED  │──► SOL transfer + PaymentRecord
                 │  DENIED    │──► MerchantNotApproved / SpendLimitExceeded
                 └────────────┘`}
        </pre>
      </motion.div>
    </main>
  );
}
