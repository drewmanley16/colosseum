"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { usePolicy } from "@/hooks/usePolicy";
import { useAgentSocket } from "@/hooks/useAgentSocket";
import { PolicyForm } from "@/components/PolicyForm";
import { PolicyGauge } from "@/components/PolicyGauge";
import { AgentTerminal } from "@/components/AgentTerminal";
import { TransactionFeed } from "@/components/TransactionFeed";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { publicKey } = useWallet();
  const [agentPubkey, setAgentPubkey] = useState<string | null>(null);
  const [agentSecretKey, setAgentSecretKey] = useState<string | null>(null);
  const [agentBalance, setAgentBalance] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { policy, loading: policyLoading, fetchPolicy, createPolicy } = usePolicy(agentPubkey);
  const { events, connected: wsConnected, startAgent, airdrop, getKeypair, clearEvents } =
    useAgentSocket();

  // Fetch policy whenever agent pubkey or user wallet changes
  useEffect(() => {
    if (publicKey && agentPubkey) fetchPolicy();
  }, [publicKey, agentPubkey, fetchPolicy]);

  // Re-fetch policy after payments come in
  useEffect(() => {
    const lastEvent = events[events.length - 1];
    if (lastEvent?.type === "payment_success") {
      fetchPolicy();
    }
    if (lastEvent?.type === "agent_done") {
      setIsRunning(false);
    }
  }, [events, fetchPolicy]);

  async function handleGenerateAgent() {
    try {
      const kp = await getKeypair();
      setAgentPubkey(kp.publicKey);
      setAgentSecretKey(kp.secretKey);
      toast.success("Agent wallet generated");
    } catch {
      toast.error("Could not reach agent server — is it running?");
    }
  }

  async function handleAirdrop() {
    const tid = toast.loading("Requesting airdrop...");
    try {
      const result = await airdrop();
      setAgentBalance(result.balance);
      toast.success(`Airdrop successful! Balance: ${result.balance?.toFixed(3)} SOL`, { id: tid });
    } catch {
      toast.error("Airdrop failed", { id: tid });
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 gap-4">
        <p className="text-gray-400">Connect your wallet to continue</p>
        <WalletMultiButton />
        <Link href="/" className="text-xs text-gray-600 hover:text-gray-400">
          ← Back
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm">
            ←
          </Link>
          <span className="font-bold text-white">APPL</span>
          <span className="text-xs text-gray-600 font-mono">
            {publicKey.toString().slice(0, 8)}...
          </span>
        </div>
        <WalletMultiButton className="!text-sm !py-1.5 !px-3" />
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Agent Wallet Setup */}
        <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Agent Wallet
          </h2>
          {!agentPubkey ? (
            <button
              onClick={handleGenerateAgent}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
            >
              Generate Agent Wallet
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Agent Address</p>
                <p className="font-mono text-sm text-white">{agentPubkey}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Balance</p>
                <p className="font-mono text-sm text-white">
                  {agentBalance !== null ? `${agentBalance.toFixed(3)} SOL` : "—"}
                </p>
              </div>
              <button
                onClick={handleAirdrop}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm transition-colors"
              >
                Airdrop 1 SOL
              </button>
            </div>
          )}
        </div>

        {/* 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Policy Manager */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Policy Manager
            </h2>

            {policy ? (
              <div className="space-y-6">
                <PolicyGauge
                  spentToday={policy.spentToday}
                  maxDailySpend={policy.maxDailySpend}
                  isActive={policy.isActive}
                />

                <div>
                  <p className="text-xs text-gray-500 mb-2">Approved Merchants</p>
                  {policy.approvedMerchants.map((m) => (
                    <div key={m} className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="font-mono text-xs text-gray-300">
                        {m.slice(0, 8)}...
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">Expires</p>
                  <p className="text-xs text-gray-300">
                    {new Date(policy.expiry * 1000).toLocaleString()}
                  </p>
                </div>

                <a
                  href={`https://explorer.solana.com/address/${policy.pda}?cluster=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-violet-400 hover:text-violet-300 font-mono"
                >
                  View on Explorer ↗
                </a>
              </div>
            ) : (
              agentPubkey ? (
                <PolicyForm
                  onSubmit={createPolicy}
                  loading={policyLoading}
                />
              ) : (
                <p className="text-xs text-gray-600 italic">
                  Generate an agent wallet first
                </p>
              )
            )}
          </div>

          {/* Middle: Agent Monitor */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col">
            <AgentTerminal events={events} isConnected={wsConnected} />

            <div className="mt-4 pt-4 border-t border-gray-800">
              <button
                onClick={handleRunAgent}
                disabled={!policy || isRunning || !agentSecretKey}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium text-sm transition-colors"
              >
                {isRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    Agent Running...
                  </span>
                ) : (
                  "Run Agent"
                )}
              </button>
              {!policy && (
                <p className="text-xs text-gray-600 text-center mt-2">
                  Create a policy first
                </p>
              )}
            </div>
          </div>

          {/* Right: Transaction Log */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <TransactionFeed events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
