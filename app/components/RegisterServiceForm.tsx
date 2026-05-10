"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { getProgram } from "@/lib/anchor";
import toast from "react-hot-toast";

interface Props {
  onRegistered?: () => void;
}

export function RegisterServiceForm({ onRegistered }: Props) {
  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    serviceUrl: "",
    feeSol: "0.01",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey || !wallet?.adapter) return;

    const feeLamports = Math.floor(parseFloat(form.feeSol) * 1e9);
    if (!form.name.trim() || !form.serviceUrl.trim() || isNaN(feeLamports) || feeLamports <= 0) {
      toast.error("Fill in all fields with valid values");
      return;
    }

    setLoading(true);
    const tid = toast.loading("Registering your service on-chain…");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anchorWallet = { publicKey, signTransaction: (wallet.adapter as any).signTransaction?.bind(wallet.adapter), signAllTransactions: (wallet.adapter as any).signAllTransactions?.bind(wallet.adapter) };
      const program = getProgram(anchorWallet, connection);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (program as any).methods
        .registerAgent(form.name.trim(), form.serviceUrl.trim(), new BN(feeLamports))
        .accounts({ authority: publicKey })
        .rpc();

      toast.success(`${form.name} registered on-chain!`, { id: tid });
      setForm({ name: "", serviceUrl: "", feeSol: "0.01" });
      setOpen(false);
      onRegistered?.();
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || String(err);
      toast.error(msg.split("\n")[0], { id: tid });
    } finally {
      setLoading(false);
    }
  }

  if (!publicKey) return null;

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.72rem",
            letterSpacing: "0.08em",
            fontWeight: 700,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            padding: "0.6rem 1.25rem",
            cursor: "pointer",
            width: "100%",
          }}
        >
          + REGISTER YOUR SERVICE
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            padding: "1.25rem",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.65rem",
              letterSpacing: "0.1em",
              fontWeight: 700,
              marginBottom: "1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>REGISTER SERVICE</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-geist-mono)",
                fontSize: "0.75rem",
                color: "var(--ink-3)",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { label: "SERVICE NAME", key: "name", placeholder: "e.g. MyDataBot", type: "text" },
              { label: "SERVICE URL", key: "serviceUrl", placeholder: "https://your-api.com/data", type: "url" },
              { label: "FEE (SOL)", key: "feeSol", placeholder: "0.01", type: "number" },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <label
                  style={{
                    display: "block",
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.1em",
                    color: "var(--ink-3)",
                    marginBottom: "0.3rem",
                  }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  step={key === "feeSol" ? "0.001" : undefined}
                  min={key === "feeSol" ? "0.0001" : undefined}
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  required
                  style={{
                    width: "100%",
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "0.78rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    color: "var(--ink)",
                    padding: "0.5rem 0.75rem",
                    outline: "none",
                  }}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "0.75rem",
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.65rem",
              color: "var(--ink-3)",
              lineHeight: 1.5,
              marginBottom: "1rem",
            }}
          >
            Your wallet becomes the authority — agent payments go directly to you.
            The service URL is called by agents after payment.
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.72rem",
              letterSpacing: "0.08em",
              fontWeight: 700,
              background: loading ? "var(--border)" : "var(--accent)",
              color: "#fff",
              border: "none",
              padding: "0.65rem",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "REGISTERING…" : "PUBLISH TO NETWORK"}
          </button>
        </form>
      )}
    </div>
  );
}
