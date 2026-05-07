# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

APPL (Agent Permissions & Policy Layer) — a Solana hackathon project for Colosseum Frontier. Enables programmable onchain spending policies that constrain autonomous AI agents. Three sub-projects in one repo:

- `appl/` — Anchor 0.31.1 Rust program (on-chain logic)
- `app/` — Next.js 16 frontend (dashboard UI)
- `agent/` — Node.js backend (GPT-4o agent + WebSocket server)

## Commands

### Anchor program (`appl/`)
```bash
# Requires: PATH includes ~/.local/share/solana/install/active_release/bin and ~/.avm/bin
anchor build                          # compile + regenerate IDL
anchor test                           # run tests against localnet (spins up validator)
anchor deploy --provider.cluster testnet
anchor idl init --provider.cluster testnet --filepath target/idl/appl.json <PROGRAM_ID>
```
After any `anchor build`, copy the updated IDL to both consumers:
```bash
cp appl/target/idl/appl.json app/lib/idl/appl.json
cp appl/target/idl/appl.json agent/lib/idl/appl.json
```

### Frontend (`app/`)
```bash
cd app
npm run dev      # http://localhost:3000
npm run build
npm run lint
npx tsc --noEmit  # type-check only
```
Copy `app/.env.local.example` → `app/.env.local` and set `NEXT_PUBLIC_SOLANA_RPC_URL`.

### Agent backend (`agent/`)
```bash
cd agent
npm run dev      # tsx watch, http://localhost:3001 + ws://localhost:3001
npm run build    # tsc → dist/
npx tsc --noEmit  # type-check only
```
Copy `agent/.env.example` → `agent/.env` and set `OPENAI_API_KEY` and `AGENT_SECRET_KEY`.

## Architecture

### Solana Program (`appl/programs/appl/src/lib.rs`)
Single-file Anchor program. Three account types (all PDAs):

| Account | Seeds | Purpose |
|---|---|---|
| `PolicyAccount` | `["policy", owner, agent]` | Spending constraints owned by user |
| `AgentIdentity` | `["agent", authority]` | Registered service registry entry |
| `PaymentRecord` | `["payment", policy, nonce]` | Immutable per-payment audit log |

The core instruction is `execute_constrained_payment` — it is signed by the **agent keypair** (not the user wallet), validates the `PolicyAccount` onchain (active, not expired, merchant in whitelist, daily spend headroom), then CPIs to `system_program::transfer`. The user wallet only signs `create_policy` / `update_policy` / `revoke_policy`.

Program ID: `J1fCzmaSM61TePcnuVGFbB55oDGWS13eYcepFMd2pNVd`

### Frontend (`app/`)
Next.js 16 App Router. All interactive components are Client Components (`"use client"`). In Next.js 16, `params` in page components is a `Promise` and must be awaited.

Key data flow:
- `WalletContextProvider` (wraps layout) → provides `useWallet` / `useConnection` everywhere
- `usePolicy` hook — reads/writes `PolicyAccount` on-chain via `@coral-xyz/anchor`
- `useAgentSocket` hook — opens a WebSocket to `localhost:3001`, streams `AgentEvent` objects to update `AgentTerminal` and `TransactionFeed` in real time
- Anchor client is initialized in `app/lib/anchor.ts`; always use `(program.account as any).policyAccount` because the generic IDL type doesn't expose named accounts

### Agent Backend (`agent/`)
Express server + `ws` WebSocket server on the same HTTP server. A single `POST /api/agent/start` kicks off `runAgent()` which runs a GPT-4o tool-use loop and `broadcast()`s every `AgentEvent` to all WebSocket clients.

Tool → implementation mapping:
- `discover_services` → `agent/src/tools/services.ts` (hardcoded mock registry)
- `check_policy_balance` → reads `PolicyAccount` PDA via Anchor
- `attempt_payment` → calls `execute_constrained_payment` instruction, signed by `AGENT_SECRET_KEY`
- `call_service` → returns mocked data (weather/price/news)

Mock service wallets are set in `agent/src/tools/services.ts` and can be overridden via env vars (`WEATHER_BOT_WALLET`, `PRICE_BOT_WALLET`, `NEWS_AGENT_WALLET`). These wallets must exist as valid Solana pubkeys that can receive SOL on testnet — they don't need to be pre-funded.

### IDL sync
The IDL at `appl/target/idl/appl.json` is the source of truth. Both `app/lib/idl/appl.json` and `agent/lib/idl/appl.json` are copies that must be kept in sync after any program change.
