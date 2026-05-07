"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentEvent } from "@/hooks/useAgentSocket";

interface AgentTerminalProps {
  events: AgentEvent[];
  isConnected: boolean;
}

function eventColor(type: AgentEvent["type"]): string {
  switch (type) {
    case "payment_success":
      return "text-green-400";
    case "payment_denied":
      return "text-red-400";
    case "payment_attempt":
      return "text-yellow-400";
    case "service_result":
      return "text-cyan-400";
    case "agent_done":
      return "text-violet-400";
    case "error":
      return "text-red-500";
    default:
      return "text-gray-300";
  }
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

export function AgentTerminal({ events, isConnected }: AgentTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Agent Monitor
        </h2>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? "bg-green-400 animate-pulse" : "bg-gray-600"
            }`}
          />
          <span className="text-xs text-gray-500">
            {isConnected ? "live" : "offline"}
          </span>
        </div>
      </div>

      <div className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-xs overflow-y-auto min-h-0 max-h-96">
        {events.length === 0 ? (
          <p className="text-gray-600 italic">Waiting for agent activity...</p>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((event, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2 mb-1 ${eventColor(event.type)}`}
              >
                <span className="text-gray-600 shrink-0 w-12">
                  {new Date(event.timestamp).toLocaleTimeString("en", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="shrink-0">{eventPrefix(event.type)}</span>
                <span className="break-all">{event.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
