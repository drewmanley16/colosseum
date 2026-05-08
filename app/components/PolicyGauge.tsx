"use client";

import { motion } from "framer-motion";
import { lamportsToSol } from "@/lib/anchor";

interface PolicyGaugeProps {
  spentToday: number;
  maxDailySpend: number;
  isActive: boolean;
}

export function PolicyGauge({ spentToday, maxDailySpend, isActive }: PolicyGaugeProps) {
  const pct = maxDailySpend > 0 ? Math.min(spentToday / maxDailySpend, 1) : 0;
  const barColor = pct >= 0.9 ? "#dc2626" : pct >= 0.6 ? "#d97706" : "var(--accent)";

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest mb-0.5" style={{ color: "var(--ink-3)" }}>
            ▪ Daily Spend
          </p>
          <p className="font-bold text-2xl leading-none" style={{ color: "var(--ink)" }}>
            {Math.round(pct * 100)}%
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs" style={{ color: "var(--ink-2)" }}>
            {lamportsToSol(spentToday)} <span style={{ color: "var(--ink-3)" }}>/ {lamportsToSol(maxDailySpend)} SOL</span>
          </p>
          {!isActive && (
            <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "#dc2626" }}>
              ▪ Inactive
            </span>
          )}
        </div>
      </div>

      <div className="h-2 border" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
        <motion.div
          className="h-full"
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
