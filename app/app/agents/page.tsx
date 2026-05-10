"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { getReadOnlyProgram, lamportsToSol, PROGRAM_ID } from "@/lib/anchor";
import { RegisterServiceForm } from "@/components/RegisterServiceForm";

interface AgentAccount {
  publicKey: string;
  authority: string;
  name: string;
  serviceUrl: string;
  feeLamports: number;
  totalEarned: number;
  isActive: boolean;
  onChain: boolean;
}

interface NetworkEvent {
  owner: string;
  action: string;
  service?: string;
  amount?: number;
  timestamp: number;
}

const MOCK_REGISTRY: Omit<AgentAccount, "publicKey" | "totalEarned" | "onChain">[] = [
  {
    authority: "2LxHNHNvQHZZUuxU6eYzm7wb3nDqKbXXzYtXefrhSdHX",
    name: "WeatherBot",
    serviceUrl: "https://appl-agent.onrender.com/services/weather",
    feeLamports: 10_000_000,
    isActive: true,
  },
  {
    authority: "DRWzZaXffPyCV1wrVN5FTSQTrnxbLACKZBDG1S1vnKfm",
    name: "PriceBot",
    serviceUrl: "https://appl-agent.onrender.com/services/price",
    feeLamports: 50_000_000,
    isActive: true,
  },
  {
    authority: "whcrCa5tJRSYAGWtsbkaFXtWvCVps3CMH2Cav2jrc2s",
    name: "NewsAgent",
    serviceUrl: "https://appl-agent.onrender.com/services/news",
    feeLamports: 20_000_000,
    isActive: true,
  },
];

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";
const WS_URL = AGENT_URL.replace(/^http/, "ws");
const EXPLORER_BASE = "https://explorer.solana.com/address";
const CLUSTER = "testnet";

function truncate(str: string, chars = 8) {
  if (str.length <= chars * 2 + 3) return str;
  return `${str.slice(0, chars)}...${str.slice(-chars)}`;
}

function categoryFromUrl(url: string): string {
  if (url.includes("weather")) return "DATA";
  if (url.includes("price")) return "DEFI";
  if (url.includes("news")) return "CONTENT";
  return "AGENT";
}

function categoryColor(cat: string): string {
  switch (cat) {
    case "DATA": return "#2563eb";
    case "DEFI": return "#7c3aed";
    case "CONTENT": return "#0f766e";
    default: return "var(--accent)";
  }
}

function actionLabel(action: string): { text: string; color: string } {
  switch (action) {
    case "payment_success": return { text: "✓ PAID", color: "#16a34a" };
    case "payment_denied": return { text: "✗ DENIED", color: "#dc2626" };
    case "agent_done": return { text: "■ DONE", color: "var(--ink-2)" };
    default: return { text: action.toUpperCase(), color: "var(--ink-3)" };
  }
}

export default function AgentsPage() {
  const { connection } = useConnection();
  const [agents, setAgents] = useState<AgentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [onChainCount, setOnChainCount] = useState(0);
  const [networkFeed, setNetworkFeed] = useState<NetworkEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const program = getReadOnlyProgram(connection);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await (program.account as any).agentIdentity.all();
      const onChainAgents: AgentAccount[] = raw.map((item: { publicKey: { toString: () => string }; account: { authority: { toString: () => string }; name: string; serviceUrl: string; feeLamports: { toNumber: () => number }; totalEarned: { toNumber: () => number }; isActive: boolean } }) => ({
        publicKey: item.publicKey.toString(),
        authority: item.account.authority.toString(),
        name: item.account.name,
        serviceUrl: item.account.serviceUrl,
        feeLamports: item.account.feeLamports.toNumber(),
        totalEarned: item.account.totalEarned.toNumber(),
        isActive: item.account.isActive,
        onChain: true,
      }));
      setOnChainCount(onChainAgents.length);

      if (onChainAgents.length > 0) {
        onChainAgents.sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return b.totalEarned - a.totalEarned;
        });
        setAgents(onChainAgents);
      } else {
        setAgents(MOCK_REGISTRY.map((svc, i) => ({
          ...svc,
          publicKey: `pending-${i}`,
          totalEarned: 0,
          onChain: false,
        })));
      }
      setLastRefresh(new Date());
    } catch {
      setAgents(MOCK_REGISTRY.map((svc, i) => ({
        ...svc,
        publicKey: `pending-${i}`,
        totalEarned: 0,
        onChain: false,
      })));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  // Connect to WS for live network feed
  useEffect(() => {
    let dead = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "network_activity") {
            setNetworkFeed((prev) => [msg as NetworkEvent, ...prev].slice(0, 30));
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        if (!dead) reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      dead = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const isLive = onChainCount > 0;
  const activeCount = agents.filter((a) => a.isActive).length;
  const totalEarned = agents.reduce((s, a) => s + a.totalEarned, 0);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Nav */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "0 2rem",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.08em", color: "var(--accent)" }}>
            APPL
          </span>
          <nav style={{ display: "flex", gap: "1.5rem" }}>
            <Link href="/" style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.75rem", letterSpacing: "0.06em", color: "var(--ink-2)", textDecoration: "none" }}>
              HOME
            </Link>
            <Link href="/dashboard" style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.75rem", letterSpacing: "0.06em", color: "var(--ink-2)", textDecoration: "none" }}>
              DASHBOARD
            </Link>
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.75rem", letterSpacing: "0.06em", color: "var(--ink)", borderBottom: "1px solid var(--accent)", paddingBottom: "1px" }}>
              NETWORK
            </span>
          </nav>
        </div>
        <button
          onClick={fetchAgents}
          disabled={loading}
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.7rem",
            letterSpacing: "0.06em",
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--ink-2)",
            padding: "0.35rem 0.75rem",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "LOADING..." : "↻ REFRESH"}
        </button>
      </header>

      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem" }}>
        {/* Page header */}
        <div style={{ marginBottom: "2rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.4rem" }}>
              <h1 style={{ fontFamily: "var(--font-geist-mono)", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "0.06em", margin: 0 }}>
                AGENT NETWORK
              </h1>
              {!loading && (
                <span style={{
                  fontFamily: "var(--font-geist-mono)", fontSize: "0.6rem", letterSpacing: "0.1em",
                  padding: "0.2rem 0.5rem",
                  border: `1px solid ${isLive ? "#16a34a" : "var(--border)"}`,
                  color: isLive ? "#16a34a" : "var(--ink-3)",
                  background: isLive ? "#f0fdf4" : "transparent",
                }}>
                  {isLive ? "● ON-CHAIN" : "○ MOCK REGISTRY"}
                </span>
              )}
            </div>
            <p style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.75rem", color: "var(--ink-2)", margin: 0 }}>
              Registered AgentIdentity PDAs · Program{" "}
              <a href={`${EXPLORER_BASE}/${PROGRAM_ID.toString()}?cluster=${CLUSTER}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                {truncate(PROGRAM_ID.toString())}
              </a>
            </p>
          </div>
        </div>

        {/* Two-column layout: agents + sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "2rem", alignItems: "start" }}>
          {/* Left: stats + agent grid */}
          <div>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
              {[
                { label: "REGISTERED AGENTS", value: agents.length.toString() },
                { label: "ACTIVE AGENTS", value: activeCount.toString() },
                { label: "TOTAL EARNED", value: isLive ? `${lamportsToSol(totalEarned)} SOL` : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", padding: "1rem 1.25rem" }}>
                  <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--ink-3)", marginBottom: "0.3rem" }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)" }}>
                    {loading ? "—" : value}
                  </div>
                </div>
              ))}
            </div>

            {/* Agent cards */}
            {!loading && agents.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
                {agents.map((agent) => {
                  const cat = categoryFromUrl(agent.serviceUrl);
                  return (
                    <div
                      key={agent.publicKey}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        padding: "1.25rem",
                        opacity: agent.isActive ? 1 : 0.6,
                        position: "relative",
                      }}
                    >
                      <div style={{ position: "absolute", top: "1rem", right: "1rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: agent.onChain ? "#16a34a" : "var(--ink-3)" }} />
                        <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.58rem", letterSpacing: "0.1em", color: agent.onChain ? "#16a34a" : "var(--ink-3)" }}>
                          {agent.onChain ? "VERIFIED" : "PENDING"}
                        </span>
                      </div>

                      <div style={{ marginBottom: "0.6rem" }}>
                        <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.58rem", letterSpacing: "0.12em", color: categoryColor(cat), border: `1px solid ${categoryColor(cat)}`, padding: "0.12rem 0.35rem", opacity: 0.8 }}>
                          {cat}
                        </span>
                      </div>

                      <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "1rem", fontWeight: 700, letterSpacing: "0.04em", marginBottom: "0.2rem" }}>
                        {agent.name}
                      </div>
                      <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.65rem", color: "var(--ink-3)", marginBottom: "1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {agent.serviceUrl}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1rem" }}>
                        {[
                          { label: "FEE", value: `${lamportsToSol(agent.feeLamports)} SOL` },
                          { label: "EARNED", value: agent.onChain ? `${lamportsToSol(agent.totalEarned)} SOL` : "—" },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: "var(--bg)", padding: "0.6rem 0.75rem" }}>
                            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.58rem", letterSpacing: "0.1em", color: "var(--ink-3)", marginBottom: "0.2rem" }}>{label}</div>
                            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.82rem", fontWeight: 700 }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.58rem", letterSpacing: "0.08em", color: "var(--ink-3)" }}>AUTHORITY</span>
                          <a href={`${EXPLORER_BASE}/${agent.authority}?cluster=${CLUSTER}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.65rem", color: "var(--accent)", textDecoration: "none" }} title={agent.authority}>
                            {truncate(agent.authority, 6)}
                          </a>
                        </div>
                        {agent.onChain && (
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.58rem", letterSpacing: "0.08em", color: "var(--ink-3)" }}>PDA</span>
                            <a href={`${EXPLORER_BASE}/${agent.publicKey}?cluster=${CLUSTER}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.65rem", color: "var(--accent)", textDecoration: "none" }} title={agent.publicKey}>
                              {truncate(agent.publicKey, 6)}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !isLive && (
              <div style={{ marginTop: "1rem", background: "var(--bg-card)", border: "1px dashed var(--border)", padding: "1rem 1.25rem", fontFamily: "var(--font-geist-mono)", fontSize: "0.7rem", color: "var(--ink-3)" }}>
                Showing mock registry — register your service above to add it on-chain.
              </div>
            )}

            {lastRefresh && (
              <div style={{ marginTop: "1.5rem", fontFamily: "var(--font-geist-mono)", fontSize: "0.62rem", color: "var(--ink-3)", textAlign: "right" }}>
                Last fetched: {lastRefresh.toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Right sidebar: register form + live feed */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Register */}
            <div>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--ink-3)", marginBottom: "0.75rem" }}>
                § YOUR SERVICE
              </div>
              <RegisterServiceForm onRegistered={fetchAgents} />
            </div>

            {/* Live network feed */}
            <div>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--ink-3)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                § LIVE ACTIVITY
                <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a", animation: "pulse 2s infinite" }} />
              </div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {networkFeed.length === 0 ? (
                  <div style={{ padding: "1.25rem", fontFamily: "var(--font-geist-mono)", fontSize: "0.7rem", color: "var(--ink-3)", textAlign: "center" }}>
                    Waiting for network activity…
                  </div>
                ) : (
                  networkFeed.map((ev, i) => {
                    const { text, color } = actionLabel(ev.action);
                    return (
                      <div
                        key={i}
                        style={{
                          padding: "0.65rem 1rem",
                          borderBottom: i < networkFeed.length - 1 ? "1px solid var(--border)" : "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.68rem", fontWeight: 700, color }}>
                            {text}
                            {ev.service && <span style={{ color: "var(--ink-2)", fontWeight: 400 }}> · {ev.service}</span>}
                          </div>
                          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.6rem", color: "var(--ink-3)" }}>
                            {ev.owner}
                            {ev.amount && <span> · {(ev.amount / 1e9).toFixed(3)} SOL</span>}
                          </div>
                        </div>
                        <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.58rem", color: "var(--ink-3)", flexShrink: 0 }}>
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
