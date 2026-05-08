import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import bs58 from "bs58";
import { PaymentResult, PolicyState } from "../types";
import IDL from "../../lib/idl/appl.json";

const PROGRAM_ID = new PublicKey("J1fCzmaSM61TePcnuVGFbB55oDGWS13eYcepFMd2pNVd");

function getConnection(): Connection {
  const rpc = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");
  return new Connection(rpc, "confirmed");
}

function loadAgentKeypair(): Keypair {
  const secretKey = process.env.AGENT_SECRET_KEY;
  if (!secretKey) throw new Error("AGENT_SECRET_KEY not set");
  return Keypair.fromSecretKey(bs58.decode(secretKey));
}

function getPolicyPDA(ownerPubkey: PublicKey, agentPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), ownerPubkey.toBuffer(), agentPubkey.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

function getPaymentRecordPDA(policyPubkey: PublicKey, nonce: bigint): PublicKey {
  const nonceBuffer = Buffer.allocUnsafe(8);
  nonceBuffer.writeBigUInt64LE(nonce);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("payment"), policyPubkey.toBuffer(), nonceBuffer],
    PROGRAM_ID
  );
  return pda;
}

export async function checkPolicyBalance(
  ownerAddress: string
): Promise<PolicyState | null> {
  try {
    const connection = getConnection();
    const agentKeypair = loadAgentKeypair();
    const ownerPubkey = new PublicKey(ownerAddress);
    const policyPDA = getPolicyPDA(ownerPubkey, agentKeypair.publicKey);

    const accountInfo = await connection.getAccountInfo(policyPDA);
    if (!accountInfo) return null;

    // Use anchor to decode the account
    const provider = new AnchorProvider(
      connection,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { publicKey: agentKeypair.publicKey, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any[]) => txs } as any,
      {}
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const program = new Program(IDL as any, provider);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const policy = await (program.account as any).policyAccount.fetch(policyPDA);

    return {
      maxDailySpend: policy.maxDailySpend.toNumber(),
      spentToday: policy.spentToday.toNumber(),
      approvedMerchants: policy.approvedMerchants.map((pk: PublicKey) => pk.toString()),
      expiry: policy.expiry.toNumber(),
      isActive: policy.isActive,
    };
  } catch (err) {
    console.error("checkPolicyBalance error:", err);
    return null;
  }
}

export async function executeConstrainedPayment(
  ownerAddress: string,
  recipientAddress: string,
  amountLamports: number,
  nonce: bigint
): Promise<PaymentResult> {
  try {
    const connection = getConnection();
    const agentKeypair = loadAgentKeypair();
    const ownerPubkey = new PublicKey(ownerAddress);
    const recipientPubkey = new PublicKey(recipientAddress);
    const policyPDA = getPolicyPDA(ownerPubkey, agentKeypair.publicKey);
    const paymentRecordPDA = getPaymentRecordPDA(policyPDA, nonce);

    const provider = new AnchorProvider(
      connection,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        publicKey: agentKeypair.publicKey,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signTransaction: async (tx: any) => { tx.partialSign(agentKeypair); return tx; },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signAllTransactions: async (txs: any[]) => { txs.forEach((tx) => tx.partialSign(agentKeypair)); return txs; },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { commitment: "confirmed" }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const program = new Program(IDL as any, provider);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await (program as any).methods
      .executeConstrainedPayment(new BN(amountLamports), new BN(nonce.toString()))
      .accounts({
        agent: agentKeypair.publicKey,
        policyAccount: policyPDA,
        recipient: recipientPubkey,
        paymentRecord: paymentRecordPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([agentKeypair])
      .rpc();

    return { success: true, signature: tx };
  } catch (err: unknown) {
    console.error("executeConstrainedPayment error:", err);
    const error = err as { message?: string; logs?: string[]; error?: { errorCode?: { code?: string } } };
    const errorCode = error?.error?.errorCode?.code || "UnknownError";
    const logs = error?.logs || [];
    const message = error?.message || String(err);
    // Try to find the most useful line from logs
    const logLine = logs.find((l) => l.includes("Error") || l.includes("failed") || l.includes("insufficient"));
    // Fall back to message, stripping noisy prefixes
    const display = logLine || (message.includes("insufficient lamports") ? "InsufficientFunds — airdrop the agent wallet" : message.split("\n")[0]);
    return { success: false, error: display, errorCode };
  }
}

export async function airdropAgent(amountSol: number = 1, publicKeyStr?: string): Promise<string> {
  const connection = getConnection();
  const pubkey = publicKeyStr ? new PublicKey(publicKeyStr) : loadAgentKeypair().publicKey;
  const sig = await connection.requestAirdrop(pubkey, amountSol * 1e9);
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

export async function getAgentBalance(publicKeyStr?: string): Promise<number> {
  const connection = getConnection();
  const pubkey = publicKeyStr ? new PublicKey(publicKeyStr) : loadAgentKeypair().publicKey;
  const lamports = await connection.getBalance(pubkey);
  return lamports / 1e9;
}
