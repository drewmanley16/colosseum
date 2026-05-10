"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState, useCallback } from "react";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

interface Stats {
  activeSessions: number;
  totalPayments: number;
}

const STEPS = [
  {
    n: "01",
    title: "Set a policy",
    desc: "Define daily spend limits, approved service agents, and expiry — enforced on-chain, not by the app.",
  },
  {
    n: "02",
    title: "Launch your agent",
    desc: "Write a goal in plain English. GPT-4o autonomously decides which services to pay for to complete it.",
  },
  {
    n: "03",
    title: "Watch it work",
    desc: "Every payment attempt — approved or denied — streams live. The blockchain is the audit log.",
  },
];

export default function Home() {
  const { connected } = useWallet();
  const [stats, setStats] = useState<Stats | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_URL}/api/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* server may be cold */ }
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 10_000);
    return () => clearInterval(t);
  }, [loadStats]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
          height: "56px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-card)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.85rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "var(--accent)",
          }}
        >
          ▪ APPL
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link
            href="/agents"
            style={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.72rem",
              letterSpacing: "0.06em",
              color: "var(--ink-2)",
              textDecoration: "none",
            }}
          >
            NETWORK ↗
          </Link>
          <WalletMultiButton
            style={{
              background: "var(--accent)",
              color: "#fff",
              fontFamily: "var(--font-geist-mono)",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "7px 16px",
              border: "none",
              borderRadius: "2px",
              height: "auto",
            }}
          />
        </div>
      </nav>

      {/* Hero */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Left */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "4rem 3.5rem",
            borderRight: "1px solid var(--border)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.68rem",
              letterSpacing: "0.12em",
              color: "var(--accent)",
              marginBottom: "1.5rem",
            }}
          >
            ▪ SOLANA · TESTNET · AI AGENTS
          </p>
          <h1
            style={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: "clamp(36px, 5vw, 72px)",
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              marginBottom: "1.75rem",
            }}
          >
            LET YOUR<br />
            AGENT SPEND<br />
            <span style={{ color: "var(--accent)" }}>ON YOUR TERMS.</span>
          </h1>
          <p
            style={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.82rem",
              lineHeight: 1.7,
              color: "var(--ink-2)",
              marginBottom: "2.5rem",
              maxWidth: "420px",
            }}
          >
            Create an AI agent. Set a spending policy. Let it loose on the
            APPL service network. Every payment enforced on-chain — the agent
            can&apos;t spend a lamport you haven&apos;t authorized.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {connected ? (
              <Link
                href="/dashboard"
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  background: "var(--accent)",
                  color: "#fff",
                  padding: "0.75rem 1.75rem",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                LAUNCH DASHBOARD →
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
                  padding: "12px 28px",
                  border: "none",
                  borderRadius: "2px",
                  height: "auto",
                }}
              />
            )}
            <Link
              href="/agents"
              style={{
                fontFamily: "var(--font-geist-mono)",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                background: "transparent",
                color: "var(--ink)",
                border: "1px solid var(--border)",
                padding: "0.75rem 1.75rem",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              VIEW NETWORK
            </Link>
          </div>

          {/* Live stats */}
          <div
            style={{
              display: "flex",
              gap: "2rem",
              marginTop: "2.5rem",
              paddingTop: "2rem",
              borderTop: "1px solid var(--border)",
            }}
          >
            {[
              {
                label: "AGENTS ONLINE",
                value: stats ? String(stats.activeSessions) : "—",
              },
              {
                label: "PAYMENTS PROCESSED",
                value: stats ? String(stats.totalPayments) : "—",
              },
              { label: "NETWORK", value: "TESTNET" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.1em",
                    color: "var(--ink-3)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — 3 steps */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "4rem 3.5rem",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.68rem",
              letterSpacing: "0.12em",
              color: "var(--ink-3)",
              marginBottom: "2rem",
            }}
          >
            § HOW IT WORKS
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {STEPS.map((step, i) => (
              <div
                key={step.n}
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  paddingBottom: i < STEPS.length - 1 ? "2rem" : 0,
                  borderBottom: i < STEPS.length - 1 ? "1px solid var(--border)" : "none",
                  marginBottom: i < STEPS.length - 1 ? "2rem" : 0,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                    letterSpacing: "0.08em",
                    paddingTop: "0.1rem",
                    flexShrink: 0,
                    width: "28px",
                  }}
                >
                  {step.n}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-geist-mono)",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      marginBottom: "0.4rem",
                      color: "var(--ink)",
                    }}
                  >
                    {step.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-geist-mono)",
                      fontSize: "0.75rem",
                      color: "var(--ink-2)",
                      lineHeight: 1.6,
                    }}
                  >
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Program box */}
          <div
            style={{
              marginTop: "2.5rem",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              padding: "1.25rem",
            }}
          >
            <pre
              style={{
                fontFamily: "var(--font-geist-mono)",
                fontSize: "0.68rem",
                color: "var(--ink-2)",
                lineHeight: 1.7,
                margin: 0,
                overflowX: "auto",
              }}
            >
{`execute_constrained_payment()
  ✓ policy.is_active
  ✓ clock < policy.expiry
  ✓ merchant in approved_list
  ✓ spent_today + amount ≤ limit
  → CPI: system_program::transfer`}
            </pre>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              borderTop: "1px solid var(--border)",
              marginTop: "1.5rem",
            }}
          >
            {[
              { n: "3", label: "SERVICES" },
              { n: "1", label: "PROGRAM" },
              { n: "∞", label: "AGENTS" },
            ].map((s, i) => (
              <div
                key={s.label}
                style={{
                  padding: "1rem 0",
                  borderRight: i < 2 ? "1px solid var(--border)" : "none",
                  paddingLeft: i > 0 ? "1rem" : 0,
                  textAlign: i === 0 ? "left" : "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  {s.n}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.1em",
                    color: "var(--ink-3)",
                    marginTop: "0.2rem",
                  }}
                >
                  ▪ {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "1.25rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.65rem",
            color: "var(--ink-3)",
            letterSpacing: "0.06em",
          }}
        >
          Colosseum Frontier Hackathon · Built on Solana
        </span>
        <a
          href="https://explorer.solana.com/address/J1fCzmaSM61TePcnuVGFbB55oDGWS13eYcepFMd2pNVd?cluster=testnet"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.65rem",
            color: "var(--accent)",
            textDecoration: "none",
            letterSpacing: "0.06em",
          }}
        >
          View Program ↗
        </a>
      </div>
    </main>
  );
}
