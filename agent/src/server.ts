import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
import { runAgent } from "./agent";
import { airdropAgent, getAgentBalance, fetchPaymentHistory, fetchOnChainServices } from "./tools/solana";
import { AgentEvent } from "./types";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Session map: sessionId → WebSocket
const sessions = new Map<string, WebSocket>();

// Running counter for network stats
let totalPaymentsNetwork = 0;

wss.on("connection", (ws) => {
  const sessionId = randomUUID();
  sessions.set(sessionId, ws);
  ws.send(JSON.stringify({ type: "session", sessionId }));
  ws.on("close", () => sessions.delete(sessionId));
});

function emitToSession(sessionId: string, event: AgentEvent) {
  const ws = sessions.get(sessionId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

// Broadcast anonymized event to ALL connected sessions (public network feed)
function broadcastNetwork(payload: {
  owner: string;
  action: string;
  service?: string;
  amount?: number;
  timestamp: number;
}) {
  const msg = JSON.stringify({ type: "network_activity", ...payload });
  for (const ws of sessions.values()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, sessions: sessions.size });
});

app.get("/api/stats", (_req, res) => {
  res.json({
    activeSessions: sessions.size,
    totalPayments: totalPaymentsNetwork,
  });
});

app.get("/api/network/agents", async (_req, res) => {
  try {
    const agents = await fetchOnChainServices();
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/agent/keypair", (_req, res) => {
  const keypair = Keypair.generate();
  res.json({
    publicKey: keypair.publicKey.toString(),
    secretKey: bs58.encode(keypair.secretKey),
  });
});

app.post("/api/agent/airdrop", async (req, res) => {
  try {
    const { agentPublicKey } = req.body as { agentPublicKey?: string };
    const sig = await airdropAgent(1, agentPublicKey);
    const balance = await getAgentBalance(agentPublicKey);
    res.json({ success: true, signature: sig, balance });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

app.get("/api/agent/balance", async (req, res) => {
  try {
    const pubkey = req.query.pubkey as string | undefined;
    const balance = await getAgentBalance(pubkey);
    res.json({ balance });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/api/agent/history", async (req, res) => {
  try {
    const { policyPDA } = req.query as { policyPDA?: string };
    if (!policyPDA) { res.status(400).json({ error: "policyPDA required" }); return; }
    const history = await fetchPaymentHistory(new PublicKey(policyPDA));
    res.json({ history });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/agent/start", async (req, res) => {
  const { ownerAddress, agentSecretKey, sessionId, mission } = req.body as {
    ownerAddress?: string;
    agentSecretKey?: string;
    sessionId?: string;
    mission?: string;
  };

  if (!ownerAddress) { res.status(400).json({ error: "ownerAddress required" }); return; }
  if (!agentSecretKey) { res.status(400).json({ error: "agentSecretKey required" }); return; }
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "valid sessionId required" }); return;
  }

  res.json({ started: true });

  const ownerShort = ownerAddress.slice(0, 6) + "…";

  runAgent(ownerAddress, agentSecretKey, (event) => {
    emitToSession(sessionId, event);

    // Broadcast significant events to the public network feed (anonymized)
    if (event.type === "payment_success") {
      totalPaymentsNetwork++;
      broadcastNetwork({
        owner: ownerShort,
        action: "payment_success",
        service: event.data?.service as string | undefined,
        amount: event.data?.amount as number | undefined,
        timestamp: event.timestamp,
      });
    } else if (event.type === "payment_denied") {
      broadcastNetwork({
        owner: ownerShort,
        action: "payment_denied",
        service: event.data?.service as string | undefined,
        timestamp: event.timestamp,
      });
    } else if (event.type === "agent_done") {
      broadcastNetwork({
        owner: ownerShort,
        action: "agent_done",
        timestamp: event.timestamp,
      });
    }
  }, mission).catch((err) => {
    emitToSession(sessionId, {
      type: "error",
      message: String(err),
      timestamp: Date.now(),
    });
  });
});

// Keep-alive ping every 10 minutes to prevent Render free-tier sleep during a session
setInterval(() => {
  for (const ws of sessions.values()) {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }
}, 10 * 60 * 1000);

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`APPL Agent Server running on http://localhost:${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}`);
});
