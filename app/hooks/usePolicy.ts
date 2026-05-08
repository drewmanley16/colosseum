"use client";

import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getProgram, getPolicyPDA, solToLamports } from "@/lib/anchor";
import toast from "react-hot-toast";

export interface PolicyFormData {
  maxDailySol: number;
  approvedMerchants: string[];
  expiryHours: number;
}

export interface PolicyData {
  pda: string;
  owner: string;
  agent: string;
  maxDailySpend: number;
  spentToday: number;
  approvedMerchants: string[];
  expiry: number;
  isActive: boolean;
}

export function usePolicy(agentPublicKey: string | null) {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPolicy = useCallback(async () => {
    if (!publicKey || !agentPublicKey) return;
    try {
      const agentPubkey = new PublicKey(agentPublicKey);
      const [pda] = getPolicyPDA(publicKey, agentPubkey);

      const program = getProgram(
        {
          publicKey,
          signTransaction: signTransaction!,
          signAllTransactions: signAllTransactions!,
        },
        connection
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = await (program.account as any).policyAccount.fetch(pda);
      setPolicy({
        pda: pda.toString(),
        owner: account.owner.toString(),
        agent: account.agent.toString(),
        maxDailySpend: (account.maxDailySpend as BN).toNumber(),
        spentToday: (account.spentToday as BN).toNumber(),
        approvedMerchants: (account.approvedMerchants as PublicKey[]).map((k) => k.toString()),
        expiry: (account.expiry as BN).toNumber(),
        isActive: account.isActive as boolean,
      });
    } catch {
      setPolicy(null);
    }
  }, [publicKey, agentPublicKey, connection, signTransaction, signAllTransactions]);

  const createPolicy = useCallback(
    async (data: PolicyFormData) => {
      if (!publicKey || !agentPublicKey || !signTransaction || !signAllTransactions) return;
      setLoading(true);
      try {
        const agentPubkey = new PublicKey(agentPublicKey);
        const program = getProgram(
          { publicKey, signTransaction, signAllTransactions },
          connection
        );

        const merchants = data.approvedMerchants
          .filter((m) => m.trim())
          .map((m) => new PublicKey(m.trim()));

        const expiry = Math.floor(Date.now() / 1000) + data.expiryHours * 3600;

        const tx = await program.methods
          .createPolicy(
            new BN(solToLamports(data.maxDailySol)),
            merchants,
            new BN(expiry)
          )
          .accounts({
            owner: publicKey,
            agent: agentPubkey,
          })
          .rpc();

        toast.success(`Policy created! Tx: ${tx.slice(0, 8)}...`);
        await fetchPolicy();
      } catch (err) {
        toast.error(`Failed: ${String(err).slice(0, 60)}`);
      } finally {
        setLoading(false);
      }
    },
    [publicKey, agentPublicKey, connection, signTransaction, signAllTransactions, fetchPolicy]
  );

  const updatePolicy = useCallback(
    async (data: Partial<PolicyFormData & { isActive: boolean }>) => {
      if (!publicKey || !agentPublicKey || !signTransaction || !signAllTransactions || !policy) return;
      setLoading(true);
      try {
        const program = getProgram(
          { publicKey, signTransaction, signAllTransactions },
          connection
        );

        const merchants = data.approvedMerchants != null
          ? data.approvedMerchants.filter((m) => m.trim()).map((m) => new PublicKey(m.trim()))
          : null;

        const expiry = data.expiryHours != null
          ? new BN(Math.floor(Date.now() / 1000) + data.expiryHours * 3600)
          : null;

        const maxSpend = data.maxDailySol != null
          ? new BN(solToLamports(data.maxDailySol))
          : null;

        const isActive = data.isActive !== undefined ? data.isActive : null;

        await program.methods
          .updatePolicy(maxSpend, merchants, expiry, isActive)
          .accounts({ owner: publicKey, policyAccount: new PublicKey(policy.pda) })
          .rpc();

        toast.success("Policy updated");
        await fetchPolicy();
      } catch (err) {
        toast.error(`Failed: ${String(err).slice(0, 60)}`);
      } finally {
        setLoading(false);
      }
    },
    [publicKey, agentPublicKey, connection, signTransaction, signAllTransactions, policy, fetchPolicy]
  );

  const revokePolicy = useCallback(async () => {
    if (!publicKey || !signTransaction || !signAllTransactions || !policy) return;
    setLoading(true);
    try {
      const program = getProgram(
        { publicKey, signTransaction, signAllTransactions },
        connection
      );
      await program.methods
        .revokePolicy()
        .accounts({
          owner: publicKey,
          policyAccount: new PublicKey(policy.pda),
        })
        .rpc();

      toast.success("Policy revoked");
      await fetchPolicy();
    } catch (err) {
      toast.error(`Failed: ${String(err).slice(0, 60)}`);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection, signTransaction, signAllTransactions, policy, fetchPolicy]);

  return { policy, loading, fetchPolicy, createPolicy, updatePolicy, revokePolicy };
}
