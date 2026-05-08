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
const WS_URL = AGENT_URL.replace("http", "ws");

export function useAgentSocket() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (e) => {
      try {
        const event: AgentEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
      } catch {
        // ignore malformed events
      }
    };

    return () => socket.close();
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  const startAgent = useCallback(
    async (ownerAddress: string, agentSecretKey: string) => {
      clearEvents();
      await fetch(`${AGENT_URL}/api/agent/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerAddress, agentSecretKey }),
      });
    },
    [clearEvents]
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

  return { events, connected, startAgent, airdrop, getKeypair, clearEvents };
}
