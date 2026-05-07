import { ServiceAgent } from "../types";

// Hardcoded service registry — in production this would be fetched from onchain AgentIdentity accounts
export const MOCK_SERVICES: ServiceAgent[] = [
  {
    id: "weather-bot",
    name: "WeatherBot",
    description: "Real-time weather data and 7-day forecasts",
    wallet: process.env.WEATHER_BOT_WALLET || "Hxr5V6DGVQn8KZEVY6FRXMqYvHTmBX9y3hkWMuHPRTe1",
    feeLamports: 10_000_000, // 0.01 SOL
    category: "data",
  },
  {
    id: "price-bot",
    name: "PriceBot",
    description: "DeFi token prices and market data feeds",
    wallet: process.env.PRICE_BOT_WALLET || "7yMW8N6ZqMVshm2kRbzVBVKtXvEj2jMv5qVqnK9LPpUi",
    feeLamports: 50_000_000, // 0.05 SOL
    category: "defi",
  },
  {
    id: "news-agent",
    name: "NewsAgent",
    description: "AI-summarized crypto and web3 news",
    wallet: process.env.NEWS_AGENT_WALLET || "DKmF9vKgBT1rPQCQxYkYKv9LXhSCfYWTKPPUXdg5mVH2",
    feeLamports: 20_000_000, // 0.02 SOL
    category: "content",
  },
];

export function discoverServices(): ServiceAgent[] {
  return MOCK_SERVICES;
}

export function getServiceById(id: string): ServiceAgent | undefined {
  return MOCK_SERVICES.find((s) => s.id === id);
}

export function callService(serviceId: string): Record<string, unknown> {
  switch (serviceId) {
    case "weather-bot":
      return {
        temperature: 72,
        condition: "Sunny",
        humidity: 45,
        wind_mph: 8,
        forecast: ["Sunny", "Partly Cloudy", "Rain", "Sunny", "Sunny", "Cloudy", "Sunny"],
        location: "San Francisco, CA",
        retrieved_at: new Date().toISOString(),
      };
    case "price-bot":
      return {
        SOL: { usd: 185.42, change_24h: 3.2 },
        ETH: { usd: 3241.18, change_24h: -1.1 },
        BTC: { usd: 68_420.5, change_24h: 0.8 },
        retrieved_at: new Date().toISOString(),
      };
    case "news-agent":
      return {
        headlines: [
          "Solana TVL hits new ATH as DeFi activity surges",
          "AI agent frameworks gaining traction in web3 ecosystem",
          "New Anchor 1.0 release brings major improvements",
        ],
        summary: "Positive momentum across the Solana ecosystem this week.",
        retrieved_at: new Date().toISOString(),
      };
    default:
      return { error: "Unknown service" };
  }
}
