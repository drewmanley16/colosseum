"use client";

import { AgentEvent } from "@/hooks/useAgentSocket";
import { lamportsToSol } from "@/lib/anchor";

interface TransactionFeedProps {
  events: AgentEvent[];
}

type TxEntry = {
  id: number;
  success: boolean;
  service: string;
  amount?: number;
  signature?: string;
  error?: string;
  timestamp: number;
};

function eventsToTxEntries(events: AgentEvent[]): TxEntry[] {
  return events
    .filter((e) => e.type === "payment_success" || e.type === "payment_denied")
    .map((e, i) => ({
      id: i,
      success: e.type === "payment_success",
      service: (e.data?.service as string) || "Unknown",
      amount: e.data?.amount as number | undefined,
      signature: e.data?.signature as string | undefined,
      error: (e.data?.errorCode as string) || (e.data?.error as string),
      timestamp: e.timestamp,
    }))
    .reverse();
}

export function TransactionFeed({ events }: TransactionFeedProps) {
  const txEntries = eventsToTxEntries(events);

  return (
    <div className="flex flex-col h-full">
      <p className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: "var(--ink-3)" }}>
        § Transaction Log
      </p>

      <div className="flex-1 overflow-y-auto space-y-2 max-h-80">
        {txEntries.length === 0 ? (
          <p className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>No transactions yet</p>
        ) : (
          txEntries.map((tx) => (
            <div
              key={tx.id}
              className="border px-3 py-2.5"
              style={{
                borderColor: tx.success ? "var(--accent)" : "#dc2626",
                background: tx.success ? "var(--accent-light)" : "#fef2f2",
                borderLeftWidth: "3px",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: tx.success ? "var(--accent)" : "#dc2626" }}>
                    {tx.success ? "✓ APPROVED" : "✗ DENIED"}
                  </span>
                  <span className="font-mono text-xs" style={{ color: "var(--ink)" }}>
                    {tx.service}
                  </span>
                </div>
                {tx.amount != null && (
                  <span className="font-mono text-xs font-bold" style={{ color: "var(--ink)" }}>
                    {lamportsToSol(tx.amount)} SOL
                  </span>
                )}
              </div>

              {tx.success && tx.signature && (
                <a
                  href={`https://explorer.solana.com/tx/${tx.signature}?cluster=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  {tx.signature.slice(0, 16)}... ↗
                </a>
              )}

              {!tx.success && tx.error && (
                <p className="font-mono text-xs" style={{ color: "#dc2626" }}>{tx.error}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
