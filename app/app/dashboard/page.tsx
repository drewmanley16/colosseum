"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import Link from "next/link";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { usePolicy } from "@/hooks/usePolicy";
import { useAgentSocket } from "@/hooks/useAgentSocket";
import { PolicyForm } from "@/components/PolicyForm";
import { PolicyControlPanel } from "@/components/PolicyControlPanel";
import { AgentTerminal } from "@/components/AgentTerminal";
import { TransactionFeed } from "@/components/TransactionFeed";
import { AgentFlow } from "@/components/AgentFlow";
import { ServiceResultPanel } from "@/components/ServiceResultPanel";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { publicKey, signMessage } = useWallet();
  const [agentPubkey, setAgentPubkey] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("agent_pubkey") : null
  );
  const [agentSecretKey, setAgentSecretKey] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("agent_secret") : null
  );
  const [agentBalance, setAgentBalance] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { policy, loading: policyLoading, fetchPolicy, createPolicy, updatePolicy, revokePolicy } =
    usePolicy(agentPubkey);
  const { events, connected: wsConnected, startAgent, airdrop, getKeypair, fetchBalance, clearEvents } =
    useAgentSocket();

  // Fetch policy on mount and when agent/wallet changes
  useEffect(() => {
    if (publicKey && agentPubkey) fetchPolicy();
  }, [publicKey, agentPubkey, fetchPolicy]);

  // Auto-refresh balance and policy after agent events
  const refreshBalance = useCallback(async () => {
    if (!agentPubkey) return;
    const bal = await fetchBalance(agentPubkey);
    if (bal !== null) setAgentBalance(bal);
  }, [agentPubkey, fetchBalance]);

  useEffect(() => {
    const lastEvent = events[events.length - 1];
    if (lastEvent?.type === "payment_success") {
      fetchPolicy();
      refreshBalance();
    }
    if (lastEvent?.type === "agent_done") {
      setIsRunning(false);
      refreshBalance();
    }
  }, [events, fetchPolicy, refreshBalance]);

  // Fetch balance on mount if wallet exists
  useEffect(() => {
    if (agentPubkey) refreshBalance();
  }, [agentPubkey, refreshBalance]);

  async function handleGenerateAgent() {
    if (!signMessage) {
      toast.error("Wallet does not support message signing");
      return;
    }
    const tid = toast.loading("Sign the message in your wallet...");
    try {
      // Derive a deterministic keypair from the user's wallet signature.
      // Same wallet → same signature → same agent keypair, always.
      const message = new TextEncoder().encode("APPL Agent Keypair v1");
      const signature = await signMessage(message);
      const seed = signature.slice(0, 32);
      const kp = Keypair.fromSeed(seed);
      const pubkey = kp.publicKey.toString();
      const secret = bs58.encode(kp.secretKey);
      setAgentPubkey(pubkey);
      setAgentSecretKey(secret);
      localStorage.setItem("agent_pubkey", pubkey);
      localStorage.setItem("agent_secret", secret);
      toast.success("Agent linked to your wallet", { id: tid });
    } catch {
      toast.error("Signature cancelled", { id: tid });
    }
  }

  function handleResetAgent() {
    localStorage.removeItem("agent_pubkey");
    localStorage.removeItem("agent_secret");
    setAgentPubkey(null);
    setAgentSecretKey(null);
    setAgentBalance(null);
  }

  async function handleAirdrop() {
    const tid = toast.loading("Requesting airdrop...");
    try {
      const result = await airdrop(agentPubkey ?? undefined);
      if (!result.success) throw new Error(result.error || "Airdrop failed");
      const bal = typeof result.balance === "number" ? result.balance : null;
      setAgentBalance(bal);
      toast.success(`Airdrop successful! Balance: ${bal != null ? bal.toFixed(3) : "??"} SOL`, { id: tid });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("429") || msg.includes("airdrop limit")) {
        toast.error("Faucet rate limit — visit faucet.solana.com to top up manually", { id: tid });
      } else {
        toast.error(msg.replace("Error: ", ""), { id: tid });
      }
    }
  }

  async function handleRunAgent() {
    if (!publicKey || !agentSecretKey) return;
    setIsRunning(true);
    clearEvents();
    await startAgent(publicKey.toString(), agentSecretKey);
  }

  if (!publicKey) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: "var(--bg)" }}>
        <p className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--ink-2)" }}>
          Connect your wallet to continue
        </p>
        <WalletMultiButton
          style={{
            background: "var(--accent)",
            color: "#fff",
            fontFamily: "var(--font-geist-mono)",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "10px 20px",
            border: "none",
            borderRadius: "2px",
            height: "auto",
          }}
        />
        <Link href="/" className="font-mono text-xs uppercase tracking-widest hover:underline" style={{ color: "var(--ink-3)" }}>
          ← Back
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="font-mono text-xs uppercase tracking-widest hover:underline" style={{ color: "var(--ink-3)" }}>
            ← Back
          </Link>
          <span className="font-mono text-sm font-bold tracking-widest uppercase" style={{ color: "var(--ink)" }}>
            ▪ APPL
          </span>
          <span className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>
            {publicKey.toString().slice(0, 8)}...
          </span>
        </div>
        <WalletMultiButton
          style={{
            background: "transparent",
            color: "var(--ink)",
            fontFamily: "var(--font-geist-mono)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "6px 14px",
            border: "1px solid var(--border)",
            borderRadius: "2px",
            height: "auto",
          }}
        />
      </header>

      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* Agent Wallet Bar */}
        <div className="border p-5 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <p className="font-mono text-xs uppercase tracking-widest mb-4" style={{ color: "var(--ink-3)" }}>
            § Agent Wallet
          </p>
          {!agentPubkey ? (
            <button
              onClick={handleGenerateAgent}
              className="font-mono text-xs font-bold uppercase tracking-widest px-5 py-2.5 border transition-colors hover:opacity-80"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-light)", letterSpacing: "0.1em" }}
            >
              ▪ Link Agent to Wallet
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ink-3)" }}>Address</p>
                <p className="font-mono text-sm font-bold" style={{ color: "var(--ink)" }}>{agentPubkey}</p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ink-3)" }}>Balance</p>
                <p className="font-mono text-sm font-bold" style={{ color: "var(--ink)" }}>
                  {agentBalance != null ? `${agentBalance.toFixed(3)} SOL` : "—"}
                </p>
              </div>
              <button
                onClick={handleAirdrop}
                className="font-mono text-xs font-bold uppercase tracking-widest px-4 py-2 border transition-opacity hover:opacity-70"
                style={{ borderColor: "var(--border)", color: "var(--ink-2)", letterSpacing: "0.08em" }}
              >
                Airdrop 1 SOL
              </button>
              <button
                onClick={refreshBalance}
                className="font-mono text-xs uppercase tracking-widest px-3 py-2 border transition-opacity hover:opacity-70"
                style={{ borderColor: "var(--border)", color: "var(--ink-3)" }}
              >
                ↻ Refresh
              </button>
              <button
                onClick={handleResetAgent}
                className="font-mono text-xs uppercase tracking-widest px-3 py-2 border transition-opacity hover:opacity-70"
                style={{ borderColor: "var(--border)", color: "var(--ink-3)" }}
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Agent Pipeline */}
        <div className="mb-6">
          <AgentFlow events={events} />
        </div>

        {/* Service Results */}
        <ServiceResultPanel events={events} />

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border" style={{ borderColor: "var(--border)" }}>
          {/* Left: Policy Control Panel */}
          <div className="p-6 border-r" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
            <p className="font-mono text-xs uppercase tracking-widest mb-5" style={{ color: "var(--ink-3)" }}>
              § Policy Control
            </p>

            {policy ? (
              <PolicyControlPanel
                policy={policy}
                loading={policyLoading}
                onUpdate={updatePolicy}
                onRevoke={revokePolicy}
              />
            ) : (
              agentPubkey ? (
                <PolicyForm onSubmit={createPolicy} loading={policyLoading} />
              ) : (
                <p className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>
                  Generate an agent wallet first
                </p>
              )
            )}
          </div>

          {/* Middle: Agent Monitor */}
          <div className="p-6 border-r flex flex-col" style={{ borderColor: "var(--border)" }}>
            <AgentTerminal events={events} isConnected={wsConnected} />
            <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={handleRunAgent}
                disabled={!policy || isRunning || !agentSecretKey}
                className="w-full py-3 font-mono text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-30"
                style={{
                  background: isRunning ? "var(--ink)" : "var(--accent)",
                  color: "#fff",
                  letterSpacing: "0.1em",
                }}
              >
                {isRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Agent Running...
                  </span>
                ) : (
                  "▪ Run Agent"
                )}
              </button>
              {!policy && agentPubkey && (
                <p className="font-mono text-xs text-center mt-2" style={{ color: "var(--ink-3)" }}>
                  Create a policy first
                </p>
              )}
            </div>
          </div>

          {/* Right: Transaction Log */}
          <div className="p-6">
            <TransactionFeed events={events} />
          </div>
        </div>
      </div>
    </main>
  );
}
