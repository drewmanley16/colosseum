import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import IDL from "./idl/appl.json";

export const PROGRAM_ID = new PublicKey(
  "J1fCzmaSM61TePcnuVGFbB55oDGWS13eYcepFMd2pNVd"
);

export const DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.testnet.solana.com";

export function getConnection() {
  return new Connection(DEVNET_RPC, "confirmed");
}

export function getProgram(wallet: AnchorWallet, connection: Connection) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(IDL as any, provider);
}

export function getPolicyPDA(ownerPubkey: PublicKey, agentPubkey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), ownerPubkey.toBuffer(), agentPubkey.toBuffer()],
    PROGRAM_ID
  );
}

export function getAgentIdentityPDA(authorityPubkey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), authorityPubkey.toBuffer()],
    PROGRAM_ID
  );
}

export function lamportsToSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4);
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * 1e9);
}
