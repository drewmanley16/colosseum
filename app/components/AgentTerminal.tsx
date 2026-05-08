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

function eventColor(type: AgentEvent["type"]): string {
  switch (type) {
    case "payment_success": return "var(--accent)";
    case "payment_denied":  return "#dc2626";
    case "payment_attempt": return "#d97706";
    case "service_result":  return "#0891b2";
    case "agent_done":      return "var(--ink)";
    case "error":           return "#dc2626";
    case "thinking":        return "var(--ink-3)";
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
        className="flex-1 p-4 font-mono text-xs overflow-y-auto min-h-0 max-h-96 border space-y-0.5"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        {events.length === 0 ? (
          <p style={{ color: "var(--ink-3)" }}>Waiting for agent activity...</p>
        ) : (
          events.map((event, i) => {
            if (event.type === "thinking" && event.message === "...") {
              return null; // suppress the placeholder
            }

            if (event.type === "reasoning") {
              return (
                <div
                  key={i}
                  className="my-2 pl-3 border-l-2 leading-relaxed"
                  style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}
                >
                  <span className="font-mono text-xs" style={{ color: "var(--ink-3)", display: "block", marginBottom: "2px" }}>
                    {new Date(event.timestamp).toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })} · GPT-4o
                  </span>
                  <span className="break-words whitespace-pre-wrap" style={{ color: "var(--ink-2)" }}>
                    {event.message}
                  </span>
                </div>
              );
            }

            if (event.type === "agent_done") {
              return (
                <div
                  key={i}
                  className="my-2 p-3 border leading-relaxed"
                  style={{ borderColor: "var(--accent)", background: "var(--accent-light)", color: "var(--ink)" }}
                >
                  <span className="font-mono text-xs uppercase tracking-widest block mb-1" style={{ color: "var(--accent)" }}>
                    ■ Mission Complete
                  </span>
                  <span className="break-words whitespace-pre-wrap text-xs" style={{ color: "var(--ink-2)" }}>
                    {event.message}
                  </span>
                </div>
              );
            }

            return (
              <div key={i} className="flex gap-2 leading-relaxed">
                <span className="shrink-0" style={{ color: "var(--ink-3)" }}>
                  {new Date(event.timestamp).toLocaleTimeString("en", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="shrink-0 font-bold" style={{ color: eventColor(event.type) }}>
                  {eventPrefix(event.type)}
                </span>
                <span className="break-all" style={{ color: eventColor(event.type) }}>
                  {event.message}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
