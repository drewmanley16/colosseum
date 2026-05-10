// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Spectrum } = require("spectrum-ts") as { Spectrum: (config: Record<string, unknown>) => Promise<{ messages: AsyncIterable<[unknown, { content: { type: string; text?: string }; reply: (text: string) => Promise<void> }]> }> };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { imessage } = require("spectrum-ts/providers/imessage") as { imessage: { config: (opts?: Record<string, unknown>) => unknown } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { terminal } = require("spectrum-ts/providers/terminal") as { terminal: { config: (opts?: Record<string, unknown>) => unknown } };
import { runAgent } from "./agent";
import { checkPolicyBalance, getAgentBalance } from "./tools/solana";
import { AgentEvent } from "./types";

const HELP = `APPL Agent — commands:
  run [mission]  launch your agent
  status         spending policy & balance
  balance        agent wallet SOL balance
  help           show this message

Example: run get today's weather and ETH price`;

const EXPLORER = "https://explorer.solana.com/address";

function formatEvent(event: AgentEvent): string | null {
  switch (event.type) {
    case "payment_success":
      return `✓ ${event.data?.service}: ${(Number(event.data?.amount) / 1e9).toFixed(3)} SOL paid`;
    case "payment_denied":
      return `✗ ${event.data?.service}: ${event.data?.errorCode || "denied"}`;
    case "service_result":
      return `📦 ${event.data?.serviceName} returned data`;
    case "agent_done":
      return `■ Done — ${event.message.slice(0, 200)}`;
    default:
      return null;
  }
}

export async function startSpectrum(): Promise<void> {
  const ownerAddress = process.env.DEMO_OWNER_ADDRESS;
  const agentSecretKey = process.env.AGENT_SECRET_KEY;
  const projectId = process.env.SPECTRUM_PROJECT_ID;
  const projectSecret = process.env.SPECTRUM_PROJECT_SECRET;

  if (!agentSecretKey || !ownerAddress) {
    console.log("[spectrum] Skipping — set AGENT_SECRET_KEY + DEMO_OWNER_ADDRESS to enable");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providers: any[] = [];

  if (projectId && projectSecret) {
    providers.push(imessage.config());
    console.log("[spectrum] iMessage provider enabled");
  }

  providers.push(terminal.config());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spectrumConfig: any = { providers };
  if (projectId) spectrumConfig.projectId = projectId;
  if (projectSecret) spectrumConfig.projectSecret = projectSecret;

  const app = await Spectrum(spectrumConfig);
  console.log("[spectrum] Listening for messages...");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const [space, message] of app.messages as AsyncIterable<[any, any]>) {
    await space.responding(async () => {
      const content = message.content;
      if (content.type !== "text" || !content.text) return;

      const raw = (content.text as string).trim();
      const lower = raw.toLowerCase();

      // ── help ─────────────────────────────────────────────────────────────
      if (lower === "help" || lower === "?") {
        await message.reply(HELP);
        return;
      }

      // ── balance ───────────────────────────────────────────────────────────
      if (lower === "balance") {
        const bal = await getAgentBalance();
        await message.reply(`Agent wallet: ${bal.toFixed(4)} SOL`);
        return;
      }

      // ── status ────────────────────────────────────────────────────────────
      if (lower === "status") {
        const policy = await checkPolicyBalance(ownerAddress, agentSecretKey);
        if (!policy) {
          await message.reply(
            "No policy found.\nCreate one at appl-agent.vercel.app/dashboard"
          );
          return;
        }
        const headroom = (policy.maxDailySpend - policy.spentToday) / 1e9;
        await message.reply(
          `Policy status\n` +
          `Limit:     ${(policy.maxDailySpend / 1e9).toFixed(3)} SOL/day\n` +
          `Spent:     ${(policy.spentToday / 1e9).toFixed(3)} SOL\n` +
          `Remaining: ${headroom.toFixed(3)} SOL\n` +
          `Merchants: ${policy.approvedMerchants.length} approved\n` +
          `Active:    ${policy.isActive ? "yes" : "NO — policy inactive"}`
        );
        return;
      }

      // ── run / go / start ─────────────────────────────────────────────────
      if (lower === "run" || lower === "go" || lower === "start" || lower.startsWith("run ")) {
        const mission = raw.replace(/^run\s*/i, "").trim() || undefined;

        await message.reply(
          mission
            ? `🤖 Starting agent\nMission: ${mission}`
            : "🤖 Starting agent (default mission — try all services)"
        );

        const lines: string[] = [];
        const signatures: string[] = [];

        await runAgent(ownerAddress, agentSecretKey, (event) => {
          const line = formatEvent(event);
          if (line) lines.push(line);
          if (event.type === "payment_success" && event.data?.signature) {
            signatures.push(event.data.signature as string);
          }
        }, mission);

        const summary = lines.length > 0
          ? lines.join("\n")
          : "No payments attempted.";

        const explorerLinks = signatures
          .map((sig) => `${EXPLORER}/${sig}?cluster=testnet`)
          .join("\n");

        await message.reply(
          summary +
          (explorerLinks ? `\n\nExplorer:\n${explorerLinks}` : "")
        );
        return;
      }

      // ── unknown ───────────────────────────────────────────────────────────
      await message.reply(`Unknown command: "${raw}"\nType "help" for options.`);
    });
  }
}
