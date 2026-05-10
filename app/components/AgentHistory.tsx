"use client";

import { useEffect, useState } from "react";

interface PaymentRecord {
  pubkey: string;
  payer: string;
  recipient: string;
  amount: number;
  timestamp: number;
  nonce: number;
}

interface Props {
  policyPDA: string;
  fetchHistory: (pda: string) => Promise<PaymentRecord[]>;
  knownWallets?: Record<string, string>; // wallet → service name
}

const EXPLORER = "https://explorer.solana.com/address";

function truncate(s: string) {
  return s.slice(0, 6) + "…" + s.slice(-4);
}

export function AgentHistory({ policyPDA, fetchHistory, knownWallets = {} }: Props) {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHistory(policyPDA).then((data) => {
      if (!cancelled) { setRecords(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [policyPDA, fetchHistory]);

  const totalSpent = records.reduce((s, r) => s + r.amount, 0);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "0.85rem 1.1rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.65rem",
            letterSpacing: "0.1em",
            fontWeight: 700,
          }}
        >
          PAYMENT HISTORY
        </span>
        {!loading && records.length > 0 && (
          <span
            style={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.65rem",
              color: "var(--ink-3)",
            }}
          >
            {(totalSpent / 1e9).toFixed(4)} SOL total
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0" }}>
        {loading && (
          <div
            style={{
              padding: "1.5rem",
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.72rem",
              color: "var(--ink-3)",
              textAlign: "center",
            }}
          >
            Loading…
          </div>
        )}

        {!loading && records.length === 0 && (
          <div
            style={{
              padding: "1.5rem",
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.72rem",
              color: "var(--ink-3)",
              textAlign: "center",
            }}
          >
            No on-chain payments yet
          </div>
        )}

        {records.map((rec) => {
          const serviceName = knownWallets[rec.recipient] || truncate(rec.recipient);
          const date = new Date(rec.timestamp * 1000);
          const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });

          return (
            <div
              key={rec.pubkey}
              style={{
                padding: "0.7rem 1.1rem",
                borderBottom: "1px solid var(--border)",
                borderLeft: "3px solid #16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "var(--ink)",
                    marginBottom: "0.15rem",
                  }}
                >
                  {serviceName}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "0.65rem",
                    color: "var(--ink-3)",
                  }}
                >
                  {dateStr} · {timeStr}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
                <span
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#16a34a",
                  }}
                >
                  −{(rec.amount / 1e9).toFixed(4)} SOL
                </span>
                <a
                  href={`${EXPLORER}/${rec.pubkey}?cluster=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "0.6rem",
                    color: "var(--accent)",
                    textDecoration: "none",
                  }}
                >
                  record ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
