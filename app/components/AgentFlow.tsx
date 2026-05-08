"use client";

import { AgentEvent } from "@/hooks/useAgentSocket";

type StepStatus = "idle" | "active" | "success" | "failed";

type Step = {
  id: string;
  num: string;
  label: string;
  detail?: string;
  status: StepStatus;
};

function deriveSteps(events: AgentEvent[]): Step[] {
  const steps: Step[] = [
    { id: "discover", num: "01", label: "Discover", status: "idle" },
    { id: "policy",   num: "02", label: "Policy Check", status: "idle" },
    { id: "pay",      num: "03", label: "Payment", status: "idle" },
    { id: "result",   num: "04", label: "Service Data", status: "idle" },
  ];

  for (const event of events) {
    const msg = event.message.toLowerCase();

    if (msg.includes("discover")) {
      if (steps[0].status === "idle") steps[0].status = "active";
    }
    if (msg.includes("services") && (msg.includes("found") || msg.includes("available") || msg.includes("weatherbot"))) {
      steps[0].status = "success";
      steps[0].detail = "3 services found";
      if (steps[1].status === "idle") steps[1].status = "active";
    }
    if (msg.includes("policy") || msg.includes("balance") || msg.includes("sol limit") || msg.includes("sol spent")) {
      if (steps[1].status === "idle") steps[1].status = "active";
    }
    if (msg.includes("merchants approved") || msg.includes("sol limit")) {
      steps[1].status = "success";
      // Grab the spend limit part
      const limitMatch = event.message.match(/[\d.]+ SOL limit/);
      steps[1].detail = limitMatch ? limitMatch[0] : event.message.slice(0, 40);
      if (steps[2].status === "idle") steps[2].status = "active";
    }
    if (event.type === "payment_attempt") {
      steps[2].status = "active";
      steps[2].detail = event.message.replace("Attempting payment of ", "").replace("...", "");
    }
    if (event.type === "payment_success") {
      steps[2].status = "success";
      steps[2].detail = event.message.slice(0, 50);
      steps[3].status = "active";
    }
    if (event.type === "payment_denied") {
      steps[2].status = "failed";
      const err = (event.data?.errorCode as string) || (event.data?.error as string) || "Denied";
      steps[2].detail = err;
    }
    if (event.type === "service_result") {
      steps[3].status = "success";
      steps[3].detail = event.message.replace(/^[^:]+:\s*/, "").slice(0, 60);
    }
    if (event.type === "agent_done") {
      if (steps[3].status === "active") steps[3].status = "success";
    }
  }

  return steps;
}

function stepBorderColor(status: StepStatus): string {
  switch (status) {
    case "active":  return "var(--accent)";
    case "success": return "var(--accent)";
    case "failed":  return "#dc2626";
    default:        return "var(--border)";
  }
}

function stepBg(status: StepStatus): string {
  switch (status) {
    case "active":  return "var(--accent-light)";
    case "success": return "var(--accent-light)";
    case "failed":  return "#fef2f2";
    default:        return "var(--bg-card)";
  }
}

function stepNumColor(status: StepStatus): string {
  switch (status) {
    case "active":
    case "success": return "var(--accent)";
    case "failed":  return "#dc2626";
    default:        return "var(--ink-3)";
  }
}

function stepLabelColor(status: StepStatus): string {
  switch (status) {
    case "active":
    case "success": return "var(--ink)";
    case "failed":  return "#dc2626";
    default:        return "var(--ink-3)";
  }
}

function statusBadge(status: StepStatus) {
  if (status === "idle") return null;
  if (status === "active") {
    return (
      <span className="flex items-center gap-1 font-mono text-xs uppercase tracking-widest" style={{ color: "var(--accent)" }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
        running
      </span>
    );
  }
  if (status === "success") {
    return <span className="font-mono text-xs" style={{ color: "var(--accent)" }}>✓</span>;
  }
  if (status === "failed") {
    return <span className="font-mono text-xs" style={{ color: "#dc2626" }}>✗</span>;
  }
}

export function AgentFlow({ events }: { events: AgentEvent[] }) {
  const steps = deriveSteps(events);
  const hasActivity = events.length > 0;

  return (
    <div className="border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <p className="font-mono text-xs uppercase tracking-widest mb-4" style={{ color: "var(--ink-3)" }}>
        § Agent Pipeline
      </p>

      {!hasActivity ? (
        <p className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>
          Run the agent to see it work in real time.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-0">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-stretch">
              {/* Step card */}
              <div
                className="flex-1 border p-3 transition-colors"
                style={{
                  borderColor: stepBorderColor(step.status),
                  background: stepBg(step.status),
                  borderLeftWidth: i === 0 ? "1px" : "0",
                }}
              >
                <div className="flex items-start justify-between mb-1">
                  <span
                    className="font-mono text-xs font-bold uppercase tracking-widest"
                    style={{ color: stepNumColor(step.status) }}
                  >
                    {step.num}
                  </span>
                  {statusBadge(step.status)}
                </div>
                <p
                  className="font-mono text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: stepLabelColor(step.status) }}
                >
                  {step.label}
                </p>
                {step.detail && (
                  <p
                    className="font-mono text-xs leading-snug break-words"
                    style={{ color: step.status === "failed" ? "#dc2626" : "var(--ink-2)" }}
                  >
                    {step.detail}
                  </p>
                )}
              </div>

              {/* Connector */}
              {i < steps.length - 1 && (
                <div className="flex items-center px-0" style={{ minWidth: "1px", background: stepBorderColor(step.status) }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
