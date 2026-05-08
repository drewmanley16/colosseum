"use client";

import { useState } from "react";
import { PolicyFormData } from "@/hooks/usePolicy";

const PRESET_MERCHANTS = [
  { name: "WeatherBot", wallet: "Hxr5V6DGVQn8KZEVY6FRXMqYvHTmBX9y3hkWMuHPRTe1" },
  { name: "PriceBot", wallet: "7yMW8N6ZqMVshm2kRbzVBVKtXvEj2jMv5qVqnK9LPpUi" },
  { name: "NewsAgent", wallet: "DKmF9vKgBT1rPQCQxYkYKv9LXhSCfYWTKPPUXdg5mVH2" },
];

interface PolicyFormProps {
  onSubmit: (data: PolicyFormData) => Promise<void>;
  loading: boolean;
  initial?: PolicyFormData;
}

export function PolicyForm({ onSubmit, loading, initial }: PolicyFormProps) {
  const [maxDailySol, setMaxDailySol] = useState(initial?.maxDailySol ?? 0.1);
  const [expiryHours, setExpiryHours] = useState(initial?.expiryHours ?? 24);
  const [selectedMerchants, setSelectedMerchants] = useState<string[]>(
    initial?.approvedMerchants ?? [PRESET_MERCHANTS[0].wallet]
  );

  function toggleMerchant(wallet: string) {
    setSelectedMerchants((prev) =>
      prev.includes(wallet) ? prev.filter((w) => w !== wallet) : [...prev, wallet]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({ maxDailySol, approvedMerchants: selectedMerchants, expiryHours });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "var(--ink-3)" }}>
          ▪ Max Daily Spend
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.001"
            max="1"
            step="0.001"
            value={maxDailySol}
            onChange={(e) => setMaxDailySol(parseFloat(e.target.value))}
            className="flex-1"
            style={{ accentColor: "var(--accent)" }}
          />
          <span className="font-mono text-sm font-bold w-20 text-right" style={{ color: "var(--ink)" }}>
            {maxDailySol.toFixed(3)} SOL
          </span>
        </div>
        <div className="h-1 mt-1 border-b" style={{ borderColor: "var(--border)" }} />
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "var(--ink-3)" }}>
          ▪ Expires In
        </label>
        <select
          value={expiryHours}
          onChange={(e) => setExpiryHours(parseInt(e.target.value))}
          className="w-full px-3 py-2 font-mono text-xs border focus:outline-none"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--ink)" }}
        >
          <option value={1}>1 hour</option>
          <option value={6}>6 hours</option>
          <option value={24}>24 hours</option>
          <option value={72}>3 days</option>
          <option value={168}>1 week</option>
        </select>
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "var(--ink-3)" }}>
          ▪ Approved Merchants
        </label>
        <div className="space-y-1.5">
          {PRESET_MERCHANTS.map((m) => {
            const selected = selectedMerchants.includes(m.wallet);
            return (
              <button
                type="button"
                key={m.wallet}
                onClick={() => toggleMerchant(m.wallet)}
                className="w-full flex items-center justify-between px-3 py-2 border font-mono text-xs transition-colors"
                style={{
                  borderColor: selected ? "var(--accent)" : "var(--border)",
                  background: selected ? "var(--accent-light)" : "var(--bg)",
                  color: selected ? "var(--accent)" : "var(--ink-2)",
                }}
              >
                <span className="font-bold uppercase">{m.name}</span>
                <span style={{ opacity: 0.6 }}>{m.wallet.slice(0, 8)}...</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || selectedMerchants.length === 0}
        className="w-full py-2.5 font-mono text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ background: "var(--accent)", color: "#fff", letterSpacing: "0.1em" }}
      >
        {loading ? "Sending..." : "▪ Create Policy Onchain"}
      </button>
    </form>
  );
}
