/**
 * Registers the 3 mock service agents on-chain as AgentIdentity PDAs.
 * Run once: npx tsx scripts/register-agents.ts
 *
 * Each service gets a fresh keypair (authority). After running, update
 * agent/src/tools/services.ts with the printed wallet addresses.
 */

import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../agent/.env") });

const IDL = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../app/lib/idl/appl.json"), "utf8")
);

const PROGRAM_ID = new PublicKey("J1fCzmaSM61TePcnuVGFbB55oDGWS13eYcepFMd2pNVd");
const RPC = process.env.SOLANA_RPC_URL || clusterApiUrl("testnet");

const SERVICES = [
  {
    id: "weather-bot",
    name: "WeatherBot",
    serviceUrl: "https://appl-agent.onrender.com/services/weather",
    feeLamports: 10_000_000, // 0.01 SOL
  },
  {
    id: "price-bot",
    name: "PriceBot",
    serviceUrl: "https://appl-agent.onrender.com/services/price",
    feeLamports: 50_000_000, // 0.05 SOL
  },
  {
    id: "news-agent",
    name: "NewsAgent",
    serviceUrl: "https://appl-agent.onrender.com/services/news",
    feeLamports: 20_000_000, // 0.02 SOL
  },
];

async function main() {
  const connection = new Connection(RPC, "confirmed");

  // Load the deploy/payer wallet — PAYER_SECRET_KEY takes precedence, falls back to AGENT_SECRET_KEY
  const payerSecretKey = process.env.PAYER_SECRET_KEY || process.env.AGENT_SECRET_KEY;
  if (!payerSecretKey) {
    console.error("Set PAYER_SECRET_KEY or AGENT_SECRET_KEY in agent/.env (base58-encoded keypair that has SOL)");
    process.exit(1);
  }
  const payer = Keypair.fromSecretKey(bs58.decode(payerSecretKey));
  console.log("Payer:", payer.publicKey.toString());

  const balance = await connection.getBalance(payer.publicKey);
  console.log("Payer balance:", balance / 1e9, "SOL\n");

  const results: Record<string, string> = {};

  for (const svc of SERVICES) {
    // Each service gets its own authority keypair (deterministic from a seed for repeatability)
    const seed = Buffer.from(`appl-service-${svc.id}-v1`);
    const paddedSeed = Buffer.alloc(32);
    seed.copy(paddedSeed);
    const authority = Keypair.fromSeed(paddedSeed);

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), authority.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Check if already registered
    const existing = await connection.getAccountInfo(pda);
    if (existing) {
      console.log(`✓ ${svc.name} already registered`);
      console.log(`  Authority: ${authority.publicKey.toString()}`);
      console.log(`  PDA:       ${pda.toString()}\n`);
      results[svc.id] = authority.publicKey.toString();
      continue;
    }

    // Fund the authority for rent + tx fee
    const airdropSig = await connection.requestAirdrop(authority.publicKey, 10_000_000);
    await connection.confirmTransaction(airdropSig, "confirmed");

    const provider = new AnchorProvider(
      connection,
      {
        publicKey: authority.publicKey,
        signTransaction: async (tx: Parameters<typeof anchor.web3.Transaction>[0]) => {
          if (tx instanceof anchor.web3.Transaction) tx.partialSign(authority);
          return tx;
        },
        signAllTransactions: async (txs: Parameters<typeof anchor.web3.Transaction>[0][]) => {
          txs.forEach((tx) => { if (tx instanceof anchor.web3.Transaction) tx.partialSign(authority); });
          return txs;
        },
      } as anchor.Wallet,
      { commitment: "confirmed" }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const program = new Program(IDL as any, provider);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await (program as any).methods
      .registerAgent(svc.name, svc.serviceUrl, new BN(svc.feeLamports))
      .accounts({ authority: authority.publicKey })
      .signers([authority])
      .rpc();

    console.log(`✓ ${svc.name} registered`);
    console.log(`  Authority: ${authority.publicKey.toString()}`);
    console.log(`  PDA:       ${pda.toString()}`);
    console.log(`  Tx:        ${tx}\n`);
    results[svc.id] = authority.publicKey.toString();
  }

  console.log("─────────────────────────────────────────────────");
  console.log("Update agent/src/tools/services.ts with these wallet addresses:");
  for (const [id, wallet] of Object.entries(results)) {
    console.log(`  ${id}: ${wallet}`);
  }
}

main().catch(console.error);
