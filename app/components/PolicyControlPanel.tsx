"use client";

import { useState } from "react";
import { PolicyData } from "@/hooks/usePolicy";
import { PolicyFormData } from "@/hooks/usePolicy";
import { lamportsToSol } from "@/lib/anchor";

const KNOWN_MERCHANTS = [
  { id: "weather-bot", name: "WeatherBot", wallet: "Hxr5V6DGVQn8KZEVY6FRXMqYvHTmBX9y3hkWMuHPRTe1", fee: 0.01 },
  { id: "price-bot",   name: "PriceBot",   wallet: "7yMW8N6ZqMVshm2kRbzVBVKtXvEj2jMv5qVqnK9LPpUi", fee: 0.05 },
  { id: "news-agent",  name: "NewsAgent",  wallet: "DKmF9vKgBT1rPQCQxYkYKv9LXhSCfYWTKPPUXdg5mVH2", fee: 0.02 },
];

const EXTEND_OPTIONS = [
  { label: "+1h",  hours: 1 },
  { label: "+24h", hours: 24 },
  { label: "+7d",  hours: 168 },
];

interface Props {
  policy: PolicyData;
  loading: boolean;
  onUpdate: (data: Partial<PolicyFormData & { isActive: boolean }>) => Promise<void>;
  onRevoke: () => Promise<void>;
}

function Divider() {
  return <div className="border-t" style={{ borderColor: "var(--border)" }} />;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "var(--ink-3)" }}>
      ▪ {children}
    </p>
  );
}

export function PolicyControlPanel({ policy, loading, onUpdate, onRevoke }: Props) {
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitValue, setLimitValue] = useState(policy.maxDailySpend / 1e9);
  const [merchantPending, setMerchantPending] = useState<string | null>(null);

  const pct = policy.maxDailySpend > 0
    ? Math.min(policy.spentToday / policy.maxDailySpend, 1)
    : 0;

  const barColor = pct >= 0.9 ? "#dc2626" : pct >= 0.6 ? "#d97706" : "var(--accent)";

  async function toggleActive() {
    await onUpdate({ isActive: !policy.isActive });
  }

  async function saveLimit() {
    await onUpdate({ maxDailySol: limitValue });
    setEditingLimit(false);
  }

  async function toggleMerchant(wallet: string) {
    setMerchantPending(wallet);
    const current = policy.approvedMerchants;
    const next = current.includes(wallet)
      ? current.filter((w) => w !== wallet)
      : [...current, wallet];
    await onUpdate({ approvedMerchants: next });
    setMerchantPending(null);
  }

  async function extendExpiry(hours: number) {
    await onUpdate({ expiryHours: hours });
  }

  const expiryDate = new Date(policy.expiry * 1000);
  const isExpired = policy.expiry * 1000 < Date.now();

  return (
    <div className="space-y-5">

      {/* Status */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Policy Status</Label>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: policy.isActive ? "var(--accent)" : "#dc2626" }}
            />
            <span className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: policy.isActive ? "var(--ink)" : "#dc2626" }}>
              {policy.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <button
          onClick={toggleActive}
          disabled={loading}
          className="font-mono text-xs font-bold uppercase tracking-widest px-4 py-2 border transition-opacity hover:opacity-70 disabled:opacity-30"
          style={{
            borderColor: policy.isActive ? "#dc2626" : "var(--accent)",
            color: policy.isActive ? "#dc2626" : "var(--accent)",
            background: policy.isActive ? "#fef2f2" : "var(--accent-light)",
          }}
        >
          {policy.isActive ? "Pause" : "Resume"}
        </button>
      </div>

      <Divider />

      {/* Spend limit */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Daily Spend Limit</Label>
          {!editingLimit && (
            <button
              onClick={() => { setLimitValue(policy.maxDailySpend / 1e9); setEditingLimit(true); }}
              className="font-mono text-xs uppercase tracking-widest hover:underline"
              style={{ color: "var(--accent)" }}
            >
              Edit
            </button>
          )}
        </div>

        {editingLimit ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={limitValue}
                onChange={(e) => setLimitValue(parseFloat(e.target.value))}
                className="flex-1"
                style={{ accentColor: "var(--accent)" }}
              />
              <input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={limitValue}
                onChange={(e) => setLimitValue(parseFloat(e.target.value))}
                className="w-24 px-2 py-1 font-mono text-xs border text-right"
                style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--ink)" }}
              />
              <span className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>SOL</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveLimit}
                disabled={loading}
                className="font-mono text-xs font-bold uppercase tracking-widest px-4 py-1.5 disabled:opacity-30 hover:opacity-80"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditingLimit(false)}
                className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border hover:opacity-70"
                style={{ borderColor: "var(--border)", color: "var(--ink-3)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="font-mono text-2xl font-bold" style={{ color: "var(--ink)" }}>
            {lamportsToSol(policy.maxDailySpend)}
            <span className="text-sm font-normal ml-1" style={{ color: "var(--ink-3)" }}>SOL / day</span>
          </p>
        )}
      </div>

      {/* Spend progress */}
      <div>
        <div className="flex justify-between mb-1">
          <Label>Spent Today</Label>
          <span className="font-mono text-xs" style={{ color: "var(--ink-2)" }}>
            {lamportsToSol(policy.spentToday)} / {lamportsToSol(policy.maxDailySpend)} SOL
          </span>
        </div>
        <div className="h-2 border" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pct * 100}%`, background: barColor }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>0</span>
          <span className="font-mono text-xs font-bold" style={{ color: barColor }}>
            {Math.round(pct * 100)}%
          </span>
          <span className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>
            {lamportsToSol(policy.maxDailySpend)} SOL
          </span>
        </div>
      </div>

      <Divider />

      {/* Merchant access */}
      <div>
        <Label>Merchant Access</Label>
        <div className="space-y-2">
          {KNOWN_MERCHANTS.map((m) => {
            const approved = policy.approvedMerchants.includes(m.wallet);
            const pending = merchantPending === m.wallet;
            return (
              <div
                key={m.wallet}
                className="flex items-center justify-between px-3 py-2.5 border"
                style={{
                  borderColor: approved ? "var(--accent)" : "var(--border)",
                  background: approved ? "var(--accent-light)" : "var(--bg)",
                  borderLeftWidth: "3px",
                }}
              >
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: approved ? "var(--ink)" : "var(--ink-3)" }}>
                    {m.name}
                  </p>
                  <p className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>
                    {m.fee} SOL / call
                  </p>
                </div>
                <button
                  onClick={() => toggleMerchant(m.wallet)}
                  disabled={loading || pending}
                  className="font-mono text-xs font-bold uppercase tracking-widest px-3 py-1.5 border transition-opacity hover:opacity-70 disabled:opacity-40"
                  style={{
                    borderColor: approved ? "#dc2626" : "var(--accent)",
                    color: approved ? "#dc2626" : "var(--accent)",
                    background: approved ? "#fef2f2" : "var(--accent-light)",
                  }}
                >
                  {pending ? "..." : approved ? "Revoke" : "Approve"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* Expiry */}
      <div>
        <Label>Policy Expiry</Label>
        <p className="font-mono text-xs mb-2" style={{ color: isExpired ? "#dc2626" : "var(--ink-2)" }}>
          {isExpired ? "⚠ EXPIRED — " : ""}{expiryDate.toLocaleString()}
        </p>
        <div className="flex gap-2">
          {EXTEND_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => extendExpiry(opt.hours)}
              disabled={loading}
              className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* Danger zone */}
      <div className="space-y-2">
        <a
          href={`https://explorer.solana.com/address/${policy.pda}?cluster=testnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-mono text-xs uppercase tracking-widest hover:underline"
          style={{ color: "var(--accent)" }}
        >
          View Policy on Explorer ↗
        </a>
        <button
          onClick={onRevoke}
          disabled={loading || !policy.isActive}
          className="w-full py-2 font-mono text-xs font-bold uppercase tracking-widest border transition-opacity hover:opacity-70 disabled:opacity-30"
          style={{ borderColor: "#dc2626", color: "#dc2626" }}
        >
          ▪ Revoke Policy Permanently
        </button>
      </div>
    </div>
  );
}
