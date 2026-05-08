"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export default function Home() {
  const { connected } = useWallet();

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="font-mono text-sm font-bold tracking-widest uppercase" style={{ color: "var(--ink)" }}>
          ▪ APPL ▪
        </span>
        <div className="flex items-center gap-6">
          <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--ink-2)" }}>
            ▪ Colosseum Frontier
          </span>
          <WalletMultiButton
            style={{
              background: "var(--accent)",
              color: "#fff",
              fontFamily: "var(--font-geist-mono)",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "8px 18px",
              border: "none",
              borderRadius: "2px",
              height: "auto",
            }}
          />
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0">
        <div className="flex flex-col justify-center px-12 py-20 border-r" style={{ borderColor: "var(--border)" }}>
          <p className="font-mono text-xs uppercase tracking-widest mb-6" style={{ color: "var(--accent)" }}>
            ▪ Solana · Testnet · AI Agents
          </p>
          <h1 className="font-bold uppercase leading-none mb-6" style={{ fontSize: "clamp(48px, 7vw, 88px)", letterSpacing: "-0.02em", color: "var(--ink)" }}>
            AGENT<br />
            PERMISSIONS<br />
            <span style={{ color: "var(--accent)" }}>&amp; POLICY</span><br />
            LAYER.
          </h1>
          <p className="font-mono text-sm leading-relaxed mb-10 max-w-md" style={{ color: "var(--ink-2)" }}>
            Programmable onchain policies that constrain autonomous AI agents.
            Define what they can spend — enforced at the protocol level, not the
            application layer.
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            {[
              "Daily spend limits",
              "Approved merchants",
              "Expiry enforcement",
              "Audit log",
            ].map((f) => (
              <span key={f} className="font-mono text-xs uppercase px-3 py-1.5 border" style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}>
                ▪ {f}
              </span>
            ))}
          </div>

          <div className="flex gap-3">
            {connected ? (
              <Link
                href="/dashboard"
                className="font-mono text-xs uppercase tracking-widest px-6 py-3 font-bold transition-opacity hover:opacity-80"
                style={{ background: "var(--accent)", color: "#fff", letterSpacing: "0.1em" }}
              >
                Open Dashboard →
              </Link>
            ) : (
              <WalletMultiButton
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: "2px",
                  height: "auto",
                }}
              />
            )}
            <a
              href={`https://explorer.solana.com/address/J1fCzmaSM61TePcnuVGFbB55oDGWS13eYcepFMd2pNVd?cluster=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs uppercase tracking-widest px-6 py-3 border font-bold transition-colors hover:bg-black/5"
              style={{ borderColor: "var(--ink)", color: "var(--ink)", letterSpacing: "0.1em" }}
            >
              View Program ↗
            </a>
          </div>
        </div>

        {/* Right: diagram */}
        <div className="flex flex-col justify-center px-12 py-20">
          <p className="font-mono text-xs uppercase tracking-widest mb-6" style={{ color: "var(--ink-3)" }}>
            § 01 · HOW IT WORKS
          </p>
          <pre className="font-mono text-xs leading-7 border p-8" style={{ borderColor: "var(--border)", color: "var(--ink-2)", background: "var(--bg-card)" }}>
{`User Wallet ──► [ PolicyAccount PDA ]
                       │ max_daily_spend: 0.1 SOL
                       │ approved_merchants: [WeatherBot]
                       │ expiry: +24h
                       ▼
Agent Wallet ──► execute_constrained_payment()
                       │
               ┌──────────────────┐
               │ ✓ APPROVED       │──► SOL transfer
               │                  │    + PaymentRecord
               │ ✗ DENIED         │──► MerchantNotApproved
               │                  │    SpendLimitExceeded
               └──────────────────┘`}
          </pre>

          <div className="grid grid-cols-3 gap-0 mt-8 border" style={{ borderColor: "var(--border)" }}>
            {[
              { n: "3", label: "Services" },
              { n: "1", label: "Program" },
              { n: "∞", label: "Agents" },
            ].map((s) => (
              <div key={s.label} className="px-6 py-5 border-r last:border-r-0" style={{ borderColor: "var(--border)" }}>
                <p className="font-bold text-3xl" style={{ color: "var(--ink)" }}>{s.n}</p>
                <p className="font-mono text-xs uppercase tracking-widest mt-1" style={{ color: "var(--ink-3)" }}>
                  ▪ {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
