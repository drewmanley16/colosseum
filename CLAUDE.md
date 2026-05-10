# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

APPL (Agent Permissions & Policy Layer) — Colosseum Frontier Hackathon. Programmable on-chain spending policies that constrain autonomous AI agents on Solana. Three sub-projects in one repo:

- `appl/` — Anchor 0.31.1 Rust program (on-chain logic)
- `app/` — Next.js 16 frontend (dashboard + network page)
- `agent/` — Node.js backend (GPT-4o agent loop + WebSocket server)

## Commands

### Anchor program (`appl/`)
```bash
# Requires PATH to include ~/.local/share/solana/install/active_release/bin and ~/.avm/bin
anchor build                          # compile + regenerate IDL
anchor test                           # run tests against localnet
anchor deploy --provider.cluster testnet
anchor idl init --provider.cluster testnet --filepath target/idl/appl.json <PROGRAM_ID>
```
After any `anchor build`, copy the IDL to both consumers:
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
npx tsc --noEmit
```
Env: copy `.env.local.example` → `.env.local`, set `NEXT_PUBLIC_SOLANA_RPC_URL` and `NEXT_PUBLIC_AGENT_URL`.

### Agent backend (`agent/`)
```bash
cd agent
npm run dev      # tsx watch on http://localhost:3001 + ws://localhost:3001
npm run build    # tsc → dist/
npx tsc --noEmit
```
Env: copy `.env.example` → `.env`, set `OPENAI_API_KEY` and `AGENT_SECRET_KEY` (base58 keypair with testnet SOL).

### Register mock services on-chain
```bash
cd agent
NODE_PATH=./node_modules npx tsx ../scripts/register-agents.ts
```
Requires `AGENT_SECRET_KEY` (or `PAYER_SECRET_KEY`) in `agent/.env` with testnet SOL. Idempotent — safe to re-run.

## Architecture

### Solana Program (`appl/programs/appl/src/lib.rs`)
Single-file Anchor program. Three PDA account types:

| Account | Seeds | Purpose |
|---|---|---|
| `PolicyAccount` | `["policy", owner, agent]` | Spending constraints owned by user wallet |
| `AgentIdentity` | `["agent", authority]` | Registered service on the APPL network |
| `PaymentRecord` | `["payment", policy, nonce]` | Immutable per-payment audit log |

`execute_constrained_payment` is signed by the **agent keypair** (not the user wallet). It validates the `PolicyAccount` on-chain (active, not expired, merchant in whitelist, daily headroom), CPIs to `system_program::transfer`, and creates a `PaymentRecord`. The user wallet only signs `create_policy` / `update_policy` / `revoke_policy`.

Program ID: `J1fCzmaSM61TePcnuVGFbB55oDGWS13eYcepFMd2pNVd` (testnet)

### Frontend (`app/`)
Next.js 16 App Router. All interactive components are Client Components (`"use client"`). Pages: `/` (landing), `/dashboard`, `/agents` (network registry).

Key data flow:
- `WalletContextProvider` wraps layout → `useWallet` / `useConnection` available everywhere
- `usePolicy` hook — reads/writes `PolicyAccount` via `@coral-xyz/anchor`; always cast as `(program.account as any).policyAccount` since the generic IDL type doesn't expose named accounts
- `useAgentSocket` hook — manages WebSocket to the agent server, handles per-session routing, exposes `events` (this session), `networkFeed` (broadcast from all sessions), `startAgent(ownerAddress, secretKey, mission?)`, `fetchHistory(policyPDA)`, `fetchStats()`
- `app/lib/anchor.ts` — exports `getProgram(wallet, connection)` for signed txs and `getReadOnlyProgram(connection)` for read-only queries (used on the `/agents` page without requiring a connected wallet)

Dashboard component responsibilities:
- `PolicyForm` / `PolicyControlPanel` — create or live-edit `PolicyAccount`
- `AgentFlow` — 4-step pipeline visualization driven by event types
- `AgentTerminal` — scrolling event feed; `reasoning` events render as GPT thought blocks
- `ServiceResultPanel` — rich data cards rendered after `service_result` events
- `TransactionFeed` — per-payment approve/deny entries with Explorer links
- `AgentHistory` — queries `PaymentRecord` PDAs for the current policy; permanent on-chain audit log
- `RegisterServiceForm` — calls `register_agent` instruction; user's wallet becomes the service authority

### Agent Backend (`agent/`)
Express + `ws` WebSocket server on the same HTTP server. Each WebSocket connection gets a UUID `sessionId`; `POST /api/agent/start` requires that `sessionId` and routes all `AgentEvent`s only to the originating session. Significant events (`payment_success`, `payment_denied`, `agent_done`) are also broadcast anonymized to **all** connected sessions as `network_activity` for the public feed.

Routes:
- `POST /api/agent/start` — `{ ownerAddress, agentSecretKey, sessionId, mission? }` → starts `runAgent()`
- `GET /api/agent/balance?pubkey=` — SOL balance for any pubkey
- `GET /api/agent/history?policyPDA=` — queries `PaymentRecord` PDAs filtered by policy
- `GET /api/network/agents` — fetches all on-chain `AgentIdentity` accounts
- `GET /api/stats` — `{ activeSessions, totalPayments }`

GPT-4o tool → implementation:
- `discover_services` → `fetchOnChainServices()` (live on-chain query), falls back to `MOCK_SERVICES`
- `check_policy_balance` → reads `PolicyAccount` PDA; requires agent keypair to derive PDA seeds
- `attempt_payment` → `executeConstrainedPayment()` signed by agent keypair; the `agentSecretKey` is threaded as a parameter through the entire call chain — never stored in `process.env` at runtime
- `call_service` → known service IDs return mock data; unknown IDs make a real HTTP request to the registered `serviceUrl`

### Agent keypair design
The agent keypair is **deterministically derived** from the user's wallet signature in the browser (`signMessage("APPL Agent Keypair v1")` → `slice(0, 32)` → `Keypair.fromSeed()`). Same wallet always produces the same agent. The secret key is stored in `localStorage` and sent to the server only when starting a run — never persisted server-side.

Service wallets in `agent/src/tools/services.ts` use deterministic seeds (`"appl-service-{id}-v1"` padded to 32 bytes). The computed addresses are:
- WeatherBot: `2LxHNHNvQHZZUuxU6eYzm7wb3nDqKbXXzYtXefrhSdHX`
- PriceBot: `DRWzZaXffPyCV1wrVN5FTSQTrnxbLACKZBDG1S1vnKfm`
- NewsAgent: `whcrCa5tJRSYAGWtsbkaFXtWvCVps3CMH2Cav2jrc2s`

### IDL sync
`appl/target/idl/appl.json` is the source of truth. `app/lib/idl/appl.json` and `agent/lib/idl/appl.json` are copies that must stay in sync after any program change.
