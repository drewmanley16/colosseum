"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type AgentEventType =
  | "thinking"
  | "reasoning"
  | "tool_call"
  | "tool_result"
  | "payment_attempt"
  | "payment_success"
  | "payment_denied"
  | "service_result"
  | "agent_done"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";
const WS_URL = AGENT_URL.replace(/^http/, "ws");

export function useAgentSocket() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let socket: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let dead = false;

    function connect() {
      socket = new WebSocket(WS_URL);
      ws.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        setSessionId(null);
        if (!dead) reconnectTimer = setTimeout(connect, 3000);
      };
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "session") { setSessionId(msg.sessionId); return; }
          setEvents((prev) => [...prev, msg as AgentEvent]);
        } catch { /* ignore */ }
      };
    }

    connect();
    return () => {
      dead = true;
      clearTimeout(reconnectTimer);
      socket.close();
    };
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  const startAgent = useCallback(
    async (ownerAddress: string, agentSecretKey: string) => {
      if (!sessionId) throw new Error("WebSocket session not ready");
      clearEvents();
      await fetch(`${AGENT_URL}/api/agent/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerAddress, agentSecretKey, sessionId }),
      });
    },
    [clearEvents, sessionId]
  );

  const airdrop = useCallback(async (agentPublicKey?: string) => {
    const res = await fetch(`${AGENT_URL}/api/agent/airdrop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentPublicKey }),
    });
    return res.json();
  }, []);

  const getKeypair = useCallback(async () => {
    const res = await fetch(`${AGENT_URL}/api/agent/keypair`);
    return res.json() as Promise<{ publicKey: string; secretKey: string }>;
  }, []);

  const fetchBalance = useCallback(async (agentPublicKey: string): Promise<number | null> => {
    try {
      const res = await fetch(`${AGENT_URL}/api/agent/balance?pubkey=${agentPublicKey}`);
      const data = await res.json();
      return typeof data.balance === "number" ? data.balance : null;
    } catch {
      return null;
    }
  }, []);

  return { events, connected, sessionId, startAgent, airdrop, getKeypair, fetchBalance, clearEvents };
}
