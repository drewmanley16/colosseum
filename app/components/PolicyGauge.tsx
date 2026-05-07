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
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct);

  const color =
    pct >= 0.9 ? "#ef4444" : pct >= 0.6 ? "#f59e0b" : "#8b5cf6";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="#1f2937"
            strokeWidth="12"
          />
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">
            {Math.round(pct * 100)}%
          </span>
          <span className="text-xs text-gray-400">used</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-300">
          <span className="font-mono text-white">{lamportsToSol(spentToday)}</span>
          <span className="text-gray-500"> / </span>
          <span className="font-mono text-white">{lamportsToSol(maxDailySpend)}</span>
          <span className="text-gray-500"> SOL</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">daily limit</p>
      </div>

      {!isActive && (
        <span className="text-xs bg-red-900/40 border border-red-700/40 text-red-400 px-2 py-0.5 rounded-full">
          Inactive
        </span>
      )}
    </div>
  );
}
