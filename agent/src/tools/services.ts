import { ServiceAgent } from "../types";
import { fetchOnChainServices } from "./solana";

export const MOCK_SERVICES: ServiceAgent[] = [
  {
    id: "weather-bot",
    name: "WeatherBot",
    description: "Real-time weather data and 7-day forecasts",
    wallet: process.env.WEATHER_BOT_WALLET || "2LxHNHNvQHZZUuxU6eYzm7wb3nDqKbXXzYtXefrhSdHX",
    feeLamports: 10_000_000,
    category: "data",
    serviceUrl: "https://appl-agent.onrender.com/services/weather",
  },
  {
    id: "price-bot",
    name: "PriceBot",
    description: "DeFi token prices and market data feeds",
    wallet: process.env.PRICE_BOT_WALLET || "DRWzZaXffPyCV1wrVN5FTSQTrnxbLACKZBDG1S1vnKfm",
    feeLamports: 50_000_000,
    category: "defi",
    serviceUrl: "https://appl-agent.onrender.com/services/price",
  },
  {
    id: "news-agent",
    name: "NewsAgent",
    description: "AI-summarized crypto and web3 news",
    wallet: process.env.NEWS_AGENT_WALLET || "whcrCa5tJRSYAGWtsbkaFXtWvCVps3CMH2Cav2jrc2s",
    feeLamports: 20_000_000,
    category: "content",
    serviceUrl: "https://appl-agent.onrender.com/services/news",
  },
];

const MOCK_DATA: Record<string, Record<string, unknown>> = {
  "weather-bot": {
    temperature: 72,
    condition: "Sunny",
    humidity: 45,
    wind_mph: 8,
    forecast: ["Sunny", "Partly Cloudy", "Rain", "Sunny", "Sunny", "Cloudy", "Sunny"],
    location: "San Francisco, CA",
    retrieved_at: new Date().toISOString(),
  },
  "price-bot": {
    SOL: { usd: 185.42, change_24h: 3.2 },
    ETH: { usd: 3241.18, change_24h: -1.1 },
    BTC: { usd: 68_420.5, change_24h: 0.8 },
    retrieved_at: new Date().toISOString(),
  },
  "news-agent": {
    headlines: [
      "Solana TVL hits new ATH as DeFi activity surges",
      "AI agent frameworks gaining traction in web3 ecosystem",
      "New Anchor 1.0 release brings major improvements",
    ],
    summary: "Positive momentum across the Solana ecosystem this week.",
    retrieved_at: new Date().toISOString(),
  },
};

// Try on-chain registry first, fall back to mock list
export async function discoverServices(): Promise<ServiceAgent[]> {
  const onChain = await fetchOnChainServices();
  if (onChain.length > 0) return onChain;
  return MOCK_SERVICES;
}

export function getServiceById(id: string, services?: ServiceAgent[]): ServiceAgent | undefined {
  const list = services || MOCK_SERVICES;
  return list.find((s) => s.id === id);
}

// Call a service — known services return mock data, custom services make real HTTP requests
export async function callService(serviceId: string, serviceUrl?: string): Promise<Record<string, unknown>> {
  // Known mock services
  if (MOCK_DATA[serviceId]) {
    return { ...MOCK_DATA[serviceId], retrieved_at: new Date().toISOString() };
  }

  // Custom registered service — attempt real HTTP call
  if (serviceUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(serviceUrl, {
        signal: controller.signal,
        headers: { "Accept": "application/json", "User-Agent": "APPL-Agent/1.0" },
      });
      clearTimeout(timeout);
      if (!res.ok) return { error: `Service returned HTTP ${res.status}` };
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return await res.json() as Record<string, unknown>;
      }
      const text = await res.text();
      return { response: text.slice(0, 500), retrieved_at: new Date().toISOString() };
    } catch (err) {
      return { error: `Service unavailable: ${String(err).split("\n")[0]}`, retrieved_at: new Date().toISOString() };
    }
  }

  return { error: "Unknown service", retrieved_at: new Date().toISOString() };
}
