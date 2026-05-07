"use client";

import { motion, AnimatePresence } from "framer-motion";
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
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Transaction Log
      </h2>

      <div className="flex-1 overflow-y-auto space-y-2 max-h-96">
        {txEntries.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No transactions yet</p>
        ) : (
          <AnimatePresence initial={false}>
            {txEntries.map((tx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`rounded-lg border px-3 py-2 ${
                  tx.success
                    ? "bg-green-950/30 border-green-800/40"
                    : "bg-red-950/30 border-red-800/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold ${
                        tx.success ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {tx.success ? "✓ APPROVED" : "✗ DENIED"}
                    </span>
                    <span className="text-xs text-gray-300 font-mono">
                      {tx.service}
                    </span>
                  </div>
                  {tx.amount && (
                    <span className="text-xs text-gray-400 font-mono">
                      {lamportsToSol(tx.amount)} SOL
                    </span>
                  )}
                </div>

                {tx.success && tx.signature && (
                  <a
                    href={`https://explorer.solana.com/tx/${tx.signature}?cluster=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-400 hover:text-violet-300 font-mono"
                  >
                    {tx.signature.slice(0, 16)}... ↗
                  </a>
                )}

                {!tx.success && tx.error && (
                  <p className="text-xs text-red-400/80 font-mono">{tx.error}</p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
