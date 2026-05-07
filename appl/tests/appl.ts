import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Appl } from "../target/types/appl";
import { assert } from "chai";

describe("appl", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Appl as Program<Appl>;
  const owner = provider.wallet as anchor.Wallet;

  let agentKeypair: Keypair;
  let merchantKeypair: Keypair;
  let policyPDA: PublicKey;
  let policyBump: number;

  before(async () => {
    agentKeypair = Keypair.generate();
    merchantKeypair = Keypair.generate();

    // Fund agent + merchant for tests
    for (const kp of [agentKeypair, merchantKeypair]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
    }

    [policyPDA, policyBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), owner.publicKey.toBuffer(), agentKeypair.publicKey.toBuffer()],
      program.programId
    );
  });

  it("registers an agent identity", async () => {
    const [agentIdentityPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), merchantKeypair.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .registerAgent("WeatherBot", "https://weatherbot.example.com", new BN(10_000_000))
      .accounts({ authority: merchantKeypair.publicKey, agentIdentity: agentIdentityPDA })
      .signers([merchantKeypair])
      .rpc();

    const identity = await program.account.agentIdentity.fetch(agentIdentityPDA);
    assert.equal(identity.name, "WeatherBot");
    assert.equal(identity.feeLamports.toNumber(), 10_000_000);
    assert.isTrue(identity.isActive);
  });

  it("creates a policy", async () => {
    const expiry = Math.floor(Date.now() / 1000) + 86_400;

    await program.methods
      .createPolicy(
        new BN(100_000_000), // 0.1 SOL daily limit
        [merchantKeypair.publicKey],
        new BN(expiry)
      )
      .accounts({
        owner: owner.publicKey,
        agent: agentKeypair.publicKey,
        policyAccount: policyPDA,
      })
      .rpc();

    const policy = await program.account.policyAccount.fetch(policyPDA);
    assert.equal(policy.maxDailySpend.toNumber(), 100_000_000);
    assert.isTrue(policy.isActive);
    assert.deepEqual(
      policy.approvedMerchants.map((k: PublicKey) => k.toString()),
      [merchantKeypair.publicKey.toString()]
    );
    console.log("  Policy PDA:", policyPDA.toString());
  });

  it("executes a constrained payment to approved merchant", async () => {
    const nonce = BigInt(1);
    const nonceBuffer = Buffer.allocUnsafe(8);
    nonceBuffer.writeBigUInt64LE(nonce);
    const [paymentRecordPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("payment"), policyPDA.toBuffer(), nonceBuffer],
      program.programId
    );

    const beforeBalance = await provider.connection.getBalance(merchantKeypair.publicKey);

    await program.methods
      .executeConstrainedPayment(new BN(10_000_000), new BN(1))
      .accounts({
        agent: agentKeypair.publicKey,
        policyAccount: policyPDA,
        recipient: merchantKeypair.publicKey,
        paymentRecord: paymentRecordPDA,
      })
      .signers([agentKeypair])
      .rpc();

    const afterBalance = await provider.connection.getBalance(merchantKeypair.publicKey);
    assert.equal(afterBalance - beforeBalance, 10_000_000, "Merchant received 0.01 SOL");

    const policy = await program.account.policyAccount.fetch(policyPDA);
    assert.equal(policy.spentToday.toNumber(), 10_000_000, "spent_today updated");

    const record = await program.account.paymentRecord.fetch(paymentRecordPDA);
    assert.equal(record.amount.toNumber(), 10_000_000);
    console.log("  Payment record PDA:", paymentRecordPDA.toString());
  });

  it("rejects payment to unapproved merchant", async () => {
    const badMerchant = Keypair.generate();
    const nonce = BigInt(2);
    const nonceBuffer = Buffer.allocUnsafe(8);
    nonceBuffer.writeBigUInt64LE(nonce);
    const [paymentRecordPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("payment"), policyPDA.toBuffer(), nonceBuffer],
      program.programId
    );

    try {
      await program.methods
        .executeConstrainedPayment(new BN(10_000_000), new BN(2))
        .accounts({
          agent: agentKeypair.publicKey,
          policyAccount: policyPDA,
          recipient: badMerchant.publicKey,
          paymentRecord: paymentRecordPDA,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail("Should have thrown MerchantNotApproved");
    } catch (err: unknown) {
      assert.include(String(err), "MerchantNotApproved");
    }
  });

  it("rejects payment that would exceed daily spend limit", async () => {
    const nonce = BigInt(3);
    const nonceBuffer = Buffer.allocUnsafe(8);
    nonceBuffer.writeBigUInt64LE(nonce);
    const [paymentRecordPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("payment"), policyPDA.toBuffer(), nonceBuffer],
      program.programId
    );

    try {
      await program.methods
        .executeConstrainedPayment(new BN(200_000_000), new BN(3)) // 0.2 SOL > 0.1 SOL limit
        .accounts({
          agent: agentKeypair.publicKey,
          policyAccount: policyPDA,
          recipient: merchantKeypair.publicKey,
          paymentRecord: paymentRecordPDA,
        })
        .signers([agentKeypair])
        .rpc();
      assert.fail("Should have thrown SpendLimitExceeded");
    } catch (err: unknown) {
      assert.include(String(err), "SpendLimitExceeded");
    }
  });

  it("revokes policy", async () => {
    await program.methods
      .revokePolicy()
      .accounts({ owner: owner.publicKey, policyAccount: policyPDA })
      .rpc();

    const policy = await program.account.policyAccount.fetch(policyPDA);
    assert.isFalse(policy.isActive);
  });
});
