import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
import { runAgent } from "./agent";
import { airdropAgent, getAgentBalance } from "./tools/solana";
import { AgentEvent } from "./types";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Session map: sessionId → WebSocket — each user gets their own channel
const sessions = new Map<string, WebSocket>();

wss.on("connection", (ws) => {
  const sessionId = randomUUID();
  sessions.set(sessionId, ws);

  // Send session ID to client so it can include it in /api/agent/start
  ws.send(JSON.stringify({ type: "session", sessionId }));

  ws.on("close", () => sessions.delete(sessionId));
});

function emitToSession(sessionId: string, event: AgentEvent) {
  const ws = sessions.get(sessionId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, sessions: sessions.size });
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

app.post("/api/agent/start", async (req, res) => {
  const { ownerAddress, agentSecretKey, sessionId } = req.body as {
    ownerAddress?: string;
    agentSecretKey?: string;
    sessionId?: string;
  };

  if (!ownerAddress) { res.status(400).json({ error: "ownerAddress required" }); return; }
  if (!agentSecretKey) { res.status(400).json({ error: "agentSecretKey required" }); return; }
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "valid sessionId required" }); return;
  }

  res.json({ started: true });

  runAgent(ownerAddress, agentSecretKey, (event) => {
    emitToSession(sessionId, event);
  }).catch((err) => {
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
