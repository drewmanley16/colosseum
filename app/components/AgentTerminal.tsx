"use client";

import { useEffect, useRef } from "react";
import { AgentEvent } from "@/hooks/useAgentSocket";

interface AgentTerminalProps {
  events: AgentEvent[];
  isConnected: boolean;
}

function eventPrefix(type: AgentEvent["type"]): string {
  switch (type) {
    case "payment_success": return "✓";
    case "payment_denied":  return "✗";
    case "payment_attempt": return "→";
    case "service_result":  return "◉";
    case "agent_done":      return "■";
    case "thinking":        return "·";
    case "error":           return "!";
    default:                return "›";
  }
}

function eventStyle(type: AgentEvent["type"]): string {
  switch (type) {
    case "payment_success": return "var(--accent)";
    case "payment_denied":  return "#dc2626";
    case "payment_attempt": return "#d97706";
    case "service_result":  return "#0891b2";
    case "agent_done":      return "var(--ink)";
    case "error":           return "#dc2626";
    default:                return "var(--ink-2)";
  }
}

export function AgentTerminal({ events, isConnected }: AgentTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--ink-3)" }}>
          § Agent Monitor
        </p>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isConnected ? "var(--accent)" : "var(--border)" }}
          />
          <span className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--ink-3)" }}>
            {isConnected ? "live" : "offline"}
          </span>
        </div>
      </div>

      <div
        className="flex-1 p-4 font-mono text-xs overflow-y-auto min-h-0 max-h-80 border"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        {events.length === 0 ? (
          <p style={{ color: "var(--ink-3)" }}>Waiting for agent activity...</p>
        ) : (
          events.map((event, i) => (
            <div key={i} className="flex gap-2 mb-1 leading-relaxed">
              <span className="shrink-0" style={{ color: "var(--ink-3)" }}>
                {new Date(event.timestamp).toLocaleTimeString("en", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="shrink-0 font-bold" style={{ color: eventStyle(event.type) }}>
                {eventPrefix(event.type)}
              </span>
              <span className="break-all" style={{ color: eventStyle(event.type) }}>
                {event.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
