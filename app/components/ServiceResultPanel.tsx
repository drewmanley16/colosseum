"use client";

import { AgentEvent } from "@/hooks/useAgentSocket";

interface ServiceResultPanelProps {
  events: AgentEvent[];
}

function WeatherCard({ data }: { data: Record<string, unknown> }) {
  const forecast = data.forecast as string[] | undefined;
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <span className="font-bold leading-none" style={{ fontSize: "clamp(32px, 5vw, 48px)", color: "var(--ink)" }}>
          {String(data.temperature ?? "—")}°F
        </span>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest" style={{ color: "var(--accent)" }}>
            {String(data.condition ?? "")}
          </p>
          <p className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>
            {String(data.location ?? "")}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {data.humidity != null && (
          <p className="font-mono text-xs" style={{ color: "var(--ink-2)" }}>
            <span style={{ color: "var(--ink-3)" }}>Humidity </span>{String(data.humidity)}%
          </p>
        )}
        {data.wind_mph != null && (
          <p className="font-mono text-xs" style={{ color: "var(--ink-2)" }}>
            <span style={{ color: "var(--ink-3)" }}>Wind </span>{String(data.wind_mph)} mph
          </p>
        )}
      </div>
      {forecast && (
        <div>
          <p className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: "var(--ink-3)" }}>7-Day</p>
          <div className="flex gap-1 flex-wrap">
            {forecast.map((f, i) => (
              <span key={i} className="font-mono text-xs px-1.5 py-0.5 border" style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}>
                {f.slice(0, 3).toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PriceCard({ data }: { data: Record<string, unknown> }) {
  const tokens = ["SOL", "ETH", "BTC"].filter((t) => t in data);
  return (
    <div className="space-y-2">
      {tokens.map((token) => {
        const info = data[token] as { usd: number; change_24h: number };
        const up = info.change_24h >= 0;
        return (
          <div key={token} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
            <span className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink)" }}>
              {token}
            </span>
            <div className="text-right">
              <p className="font-mono text-sm font-bold" style={{ color: "var(--ink)" }}>
                ${info.usd.toLocaleString()}
              </p>
              <p className="font-mono text-xs" style={{ color: up ? "var(--accent)" : "#dc2626" }}>
                {up ? "▲" : "▼"} {Math.abs(info.change_24h)}%
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NewsCard({ data }: { data: Record<string, unknown> }) {
  const headlines = data.headlines as string[] | undefined;
  return (
    <div className="space-y-2">
      {data.summary != null && (
        <p className="font-mono text-xs leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {String(data.summary)}
        </p>
      )}
      {headlines && (
        <div className="space-y-1.5 pt-1">
          {headlines.map((h, i) => (
            <div key={i} className="flex gap-2">
              <span className="font-mono text-xs shrink-0" style={{ color: "var(--accent)" }}>▪</span>
              <span className="font-mono text-xs leading-snug" style={{ color: "var(--ink)" }}>{h}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({ event }: { event: AgentEvent }) {
  const data = event.data ?? {};
  const serviceId = data.serviceId as string | undefined;
  const serviceName = data.serviceName as string ?? "Service";

  return (
    <div className="border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-xs" style={{ color: "var(--accent)" }}>◉</span>
        <p className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink)" }}>
          {serviceName}
        </p>
        <span className="font-mono text-xs ml-auto" style={{ color: "var(--ink-3)" }}>
          {new Date(event.timestamp).toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>
      {serviceId === "weather-bot" && <WeatherCard data={data} />}
      {serviceId === "price-bot" && <PriceCard data={data} />}
      {serviceId === "news-agent" && <NewsCard data={data} />}
    </div>
  );
}

export function ServiceResultPanel({ events }: ServiceResultPanelProps) {
  const results = events.filter((e) => e.type === "service_result");
  if (results.length === 0) return null;

  return (
    <div className="border p-5 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
      <p className="font-mono text-xs uppercase tracking-widest mb-4" style={{ color: "var(--ink-3)" }}>
        § Service Results
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border" style={{ borderColor: "var(--border)" }}>
        {results.map((event, i) => (
          <div key={i} className="border-r last:border-r-0" style={{ borderColor: "var(--border)" }}>
            <ServiceCard event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}
