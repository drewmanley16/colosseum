# APPL — Agent Permissions & Policy Layer

**Colosseum Frontier Hackathon submission.**

Programmable on-chain spending policies that constrain autonomous AI agents on Solana. Define what your agent can spend, which services it can pay, and when the policy expires — enforced at the protocol level by an Anchor program, not by the application.

🌐 **Live demo:** [appl-agent.vercel.app](https://appl-agent.vercel.app)  
🤖 **Agent API:** [colosseum-d0l3.onrender.com](https://colosseum-d0l3.onrender.com)  
🔗 **Program:** [`J1fCzmaSM61TePcnuVGFbB55oDGWS13eYcepFMd2pNVd`](https://explorer.solana.com/address/J1fCzmaSM61TePcnuVGFbB55oDGWS13eYcepFMd2pNVd?cluster=testnet) on Solana Testnet

---

## The Problem

Autonomous AI agents need to spend money to do useful work — paying for data feeds, APIs, compute. But giving an agent unrestricted access to a wallet is dangerous. Current solutions rely on the agent itself to enforce limits, which defeats the purpose.

## The Solution

APPL enforces spending constraints **on-chain**. The agent's payment instruction is validated by an Anchor program before any SOL moves. The agent cannot override or circumvent it — the blockchain is the enforcer.

```
execute_constrained_payment()
  ✓ policy.is_active
  ✓ clock < policy.expiry
  ✓ merchant in approved_list
  ✓ spent_today + amount ≤ daily_limit
  → CPI: system_program::transfer
  → creates PaymentRecord PDA (immutable audit log)
```

---

## Architecture

```
User Browser (Next.js)
  ├── Connect wallet (Phantom/Backpack)
  ├── Create/update PolicyAccount on-chain
  └── Start agent → watch live WebSocket feed

Agent API Server (Node.js + Express + ws)
  ├── POST /api/agent/start  → spawns GPT-4o tool-use loop
  ├── WS /                   → streams AgentEvents per session
  └── GET /api/stats         → live network stats

Solana Testnet (Anchor Program)
  ├── PolicyAccount PDA      → spending constraints
  ├── AgentIdentity PDA      → registered service registry
  └── PaymentRecord PDA      → immutable payment audit log
```

---

## On-Chain Accounts

### PolicyAccount
Seeds: `["policy", owner, agent]`

| Field | Type | Description |
|---|---|---|
| `owner` | Pubkey | User wallet that controls the policy |
| `agent` | Pubkey | Agent keypair being governed |
| `max_daily_spend` | u64 | Max lamports spendable per 24h |
| `spent_today` | u64 | Running total, resets with clock |
| `last_reset` | i64 | Unix timestamp of last daily reset |
| `approved_merchants` | Vec<Pubkey> | Whitelist of payable wallets |
| `expiry` | i64 | Unix timestamp after which policy is void |
| `is_active` | bool | Can be toggled by owner |

### AgentIdentity
Seeds: `["agent", authority]`

Registered service agents discoverable by any APPL agent on the network. Anyone can register their own service.

### PaymentRecord
Seeds: `["payment", policy, nonce]`

Immutable on-chain receipt created for every approved payment.

---

## Instructions

| Instruction | Signer | Description |
|---|---|---|
| `create_policy` | Owner wallet | Create a spending policy for an agent |
| `update_policy` | Owner wallet | Adjust limits, merchants, expiry, active state |
| `revoke_policy` | Owner wallet | Permanently deactivate |
| `register_agent` | Service wallet | Register a service on the APPL network |
| `execute_constrained_payment` | **Agent keypair** | Pay a service — validated by policy on-chain |

The key design: **the user's wallet never signs payments**. Only the agent keypair signs `execute_constrained_payment`. The user's wallet only controls policy creation and updates.

---

## Features

### For Users
- **Custom agent missions** — write a goal in plain English; GPT-4o autonomously decides which services to pay for
- **Live policy controls** — adjust spend limit, approve/revoke merchants, extend expiry, toggle active/inactive in real-time
- **Agent linked to wallet** — your agent keypair is deterministically derived from a wallet signature (same wallet → same agent, every time)
- **Payment history** — permanent on-chain `PaymentRecord` PDAs shown as audit log in dashboard

### For Service Builders
- **Register your service** — publish an `AgentIdentity` PDA with your name, URL, and fee; agents discover and pay you automatically
- **Real HTTP calls** — after payment, the agent actually calls your service URL and uses the response
- **On-chain earnings** — `total_earned` tracked per service in `AgentIdentity`

### Network
- **Public activity feed** — anonymized payment events broadcast to all connected clients; watch the network live on `/agents`
- **Live stats** — agents online, payments processed, updated every 10s on the landing page
- **Dynamic service discovery** — agent fetches all on-chain `AgentIdentity` accounts at runtime; no hardcoded list

---

## Demo Flow (~4 minutes)

1. Open [appl-agent.vercel.app](https://appl-agent.vercel.app) — connect Phantom wallet
2. Click **Launch Dashboard** → sign one message to generate your deterministic agent keypair
3. Airdrop SOL to agent wallet (or transfer from faucet.solana.com)
4. Create a policy: 0.1 SOL/day, approve WeatherBot only, 24h expiry
5. Type a mission: *"Get the weather forecast and check today's prices"*
6. Click **Run Agent** — watch the pipeline light up:
   - Agent discovers 3 services on the network
   - Checks policy balance on-chain
   - Pays WeatherBot (approved) → SOL transfers, PaymentRecord created
   - Attempts PriceBot (not approved) → `MerchantNotApproved` on-chain
   - Calls WeatherBot API and reports data
7. Open `/agents` → watch the live activity feed receive the events
8. Open Solana Explorer → show PolicyAccount, PaymentRecord, SOL transfer

**Key talking point:** *"The agent is real, the decision is autonomous, but the boundary is enforced on-chain — not by the agent itself."*

---

## Tech Stack

| Layer | Technology |
|---|---|
| Solana program | Rust + Anchor 0.31.1 |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Wallet | `@solana/wallet-adapter-react` (Phantom, Backpack) |
| Anchor client | `@coral-xyz/anchor`, `@solana/web3.js` |
| Agent backend | Node.js, TypeScript, Express, `ws` |
| AI | OpenAI SDK — GPT-4o with tool use |
| Hosting | Vercel (frontend) + Render (agent API) |

---

## Local Development

### Prerequisites
- Rust + Anchor 0.31.1
- Node.js 20+
- Phantom or Backpack wallet browser extension

### Anchor Program

```bash
# Build and deploy
anchor build
anchor deploy --provider.cluster testnet

# After any program change, sync IDL to consumers
cp appl/target/idl/appl.json app/lib/idl/appl.json
cp appl/target/idl/appl.json agent/lib/idl/appl.json

# Run tests
anchor test
```

### Agent Backend

```bash
cd agent
cp .env.example .env   # add OPENAI_API_KEY and AGENT_SECRET_KEY
npm install
npm run dev            # http://localhost:3001 + ws://localhost:3001
```

### Frontend

```bash
cd app
cp .env.local.example .env.local   # set NEXT_PUBLIC_SOLANA_RPC_URL
npm install
npm run dev                         # http://localhost:3000
```

### Register Mock Services On-Chain

```bash
# Requires AGENT_SECRET_KEY (with testnet SOL) in agent/.env
cd agent
NODE_PATH=./node_modules npx tsx ../scripts/register-agents.ts
```

---

## Environment Variables

### `agent/.env`
```
OPENAI_API_KEY=sk-...
AGENT_SECRET_KEY=<base58 keypair with testnet SOL — used as payer>
SOLANA_RPC_URL=https://api.testnet.solana.com
PORT=3001
```

### `app/.env.local`
```
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.testnet.solana.com
NEXT_PUBLIC_AGENT_URL=http://localhost:3001
```

---

## Project Structure

```
colosseum/
├── appl/                          # Anchor program (Rust)
│   └── programs/appl/src/lib.rs  # All instructions in one file
├── app/                           # Next.js frontend
│   ├── app/
│   │   ├── page.tsx               # Landing page
│   │   ├── dashboard/page.tsx     # Main dashboard
│   │   └── agents/page.tsx        # Network agent registry
│   ├── components/                # PolicyForm, AgentTerminal, etc.
│   ├── hooks/
│   │   ├── usePolicy.ts           # On-chain policy CRUD
│   │   └── useAgentSocket.ts      # WebSocket + network feed
│   └── lib/anchor.ts             # Program client setup
├── agent/                         # Node.js agent server
│   └── src/
│       ├── server.ts              # Express + WebSocket
│       ├── agent.ts               # GPT-4o tool-use loop
│       └── tools/
│           ├── solana.ts          # On-chain interactions
│           └── services.ts        # Service discovery + HTTP calls
└── scripts/
    └── register-agents.ts         # Register mock services on-chain
```
