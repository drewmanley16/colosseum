import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
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

const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

function broadcast(event: AgentEvent) {
  const data = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/agent/keypair", (_req, res) => {
  // Generate a fresh agent keypair for this session
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
  const { ownerAddress, agentSecretKey } = req.body;

  if (!ownerAddress) {
    res.status(400).json({ error: "ownerAddress required" });
    return;
  }

  if (!agentSecretKey) {
    res.status(400).json({ error: "agentSecretKey required" });
    return;
  }

  res.json({ started: true });

  runAgent(ownerAddress, agentSecretKey, (event) => {
    broadcast(event);
  }).catch((err) => {
    broadcast({
      type: "error",
      message: String(err),
      timestamp: Date.now(),
    });
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`APPL Agent Server running on http://localhost:${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}`);
});
