"use client";

import { useState } from "react";
import { PolicyFormData } from "@/hooks/usePolicy";

// Pre-registered mock service wallets (match agent/src/tools/services.ts)
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
    await onSubmit({
      maxDailySol,
      approvedMerchants: selectedMerchants,
      expiryHours,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Daily spend limit */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">
          Max Daily Spend
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.001"
            max="1"
            step="0.001"
            value={maxDailySol}
            onChange={(e) => setMaxDailySol(parseFloat(e.target.value))}
            className="flex-1 accent-violet-500"
          />
          <span className="text-sm font-mono text-white w-20 text-right">
            {maxDailySol.toFixed(3)} SOL
          </span>
        </div>
      </div>

      {/* Expiry */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">
          Expires In
        </label>
        <select
          value={expiryHours}
          onChange={(e) => setExpiryHours(parseInt(e.target.value))}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
        >
          <option value={1}>1 hour</option>
          <option value={6}>6 hours</option>
          <option value={24}>24 hours</option>
          <option value={72}>3 days</option>
          <option value={168}>1 week</option>
        </select>
      </div>

      {/* Approved merchants */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">
          Approved Merchants
        </label>
        <div className="space-y-2">
          {PRESET_MERCHANTS.map((m) => (
            <button
              type="button"
              key={m.wallet}
              onClick={() => toggleMerchant(m.wallet)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                selectedMerchants.includes(m.wallet)
                  ? "bg-violet-900/40 border-violet-600/60 text-violet-200"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600"
              }`}
            >
              <span className="font-medium">{m.name}</span>
              <span className="font-mono text-xs opacity-60">
                {m.wallet.slice(0, 8)}...
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || selectedMerchants.length === 0}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium text-sm transition-colors"
      >
        {loading ? "Sending..." : "Create Policy Onchain"}
      </button>
    </form>
  );
}
