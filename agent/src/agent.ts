import OpenAI from "openai";
import { AgentEvent } from "./types";
import { discoverServices, getServiceById, callService } from "./tools/services";
import { checkPolicyBalance, executeConstrainedPayment } from "./tools/solana";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "discover_services",
      description: "Discover available AI service agents on the APPL network that can be paid for data or computation",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "check_policy_balance",
      description: "Check the current on-chain spending policy — limits, spent today, approved merchants",
      parameters: {
        type: "object",
        properties: {
          owner_address: { type: "string", description: "The Solana wallet address of the policy owner" },
        },
        required: ["owner_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "attempt_payment",
      description: "Attempt to pay a service agent. The on-chain policy program validates or rejects the transaction.",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string", description: "The service agent ID (from discover_services)" },
          owner_address: { type: "string", description: "The policy owner wallet address" },
        },
        required: ["service_id", "owner_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "call_service",
      description: "Retrieve data from a service (only after successful payment)",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string", description: "The service agent ID" },
        },
        required: ["service_id"],
      },
    },
  },
];

export async function runAgent(
  ownerAddress: string,
  agentSecretKey: string,
  emit: (event: AgentEvent) => void,
  mission?: string
): Promise<void> {
  const missionText = mission?.trim() ||
    "Discover all available services, then attempt to pay for and retrieve data from every one of them. Try every service.";

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are APPL Agent — an autonomous AI agent running on Solana testnet.

Your mission: ${missionText}

You have a constrained wallet governed by an on-chain spending policy. The policy enforces which services you can pay and how much you can spend per day. You cannot override it — it's enforced at the protocol level.

Workflow:
1. Call discover_services to see what services are available on the network.
2. Call check_policy_balance to understand your spending constraints.
3. For each relevant service: attempt_payment, then if approved call call_service to get the data.
4. Think out loud about each decision. When a payment is denied, explain which policy rule blocked it.
5. After completing your mission, write a concise summary of what you accomplished.

The policy owner's Solana address is: ${ownerAddress}`,
    },
    {
      role: "user",
      content: `Mission: ${missionText}`,
    },
  ];

  let nonce = BigInt(Date.now());
  const paidServices = new Set<string>();
  // Discovered services cached for this run so call_service can look up serviceUrl
  let discoveredServices: Awaited<ReturnType<typeof discoverServices>> = [];

  for (let turn = 0; turn < 20; turn++) {
    emit({ type: "thinking", message: "...", timestamp: Date.now() });

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    messages.push(choice.message);

    if (choice.message.content) {
      emit({ type: "reasoning", message: choice.message.content, timestamp: Date.now() });
    }

    if (choice.finish_reason === "stop") {
      emit({ type: "agent_done", message: choice.message.content || "Done.", timestamp: Date.now() });
      break;
    }

    if (!choice.message.tool_calls?.length) break;

    const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

    for (const toolCall of choice.message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      let result: unknown;

      if (toolCall.function.name === "discover_services") {
        discoveredServices = await discoverServices();
        emit({
          type: "tool_call",
          message: `Discovering services on the APPL network...`,
          data: { services: discoveredServices.map((s) => `${s.name} (${s.feeLamports / 1e9} SOL)`) },
          timestamp: Date.now(),
        });
        result = discoveredServices;

      } else if (toolCall.function.name === "check_policy_balance") {
        const policy = await checkPolicyBalance(args.owner_address, agentSecretKey);
        emit({
          type: "tool_call",
          message: policy
            ? `Policy: ${policy.spentToday / 1e9} SOL spent of ${policy.maxDailySpend / 1e9} SOL limit · ${policy.approvedMerchants.length} merchants approved`
            : "No policy found for this agent",
          data: (policy as unknown as Record<string, unknown>) || {},
          timestamp: Date.now(),
        });
        result = policy;

      } else if (toolCall.function.name === "attempt_payment") {
        const service = getServiceById(args.service_id, discoveredServices);
        if (!service) {
          result = { success: false, error: "Unknown service ID" };
        } else {
          emit({
            type: "payment_attempt",
            message: `Attempting payment of ${service.feeLamports / 1e9} SOL to ${service.name}...`,
            data: { service: service.name, amount: service.feeLamports },
            timestamp: Date.now(),
          });

          const payResult = await executeConstrainedPayment(
            args.owner_address,
            service.wallet,
            service.feeLamports,
            nonce++,
            agentSecretKey
          );

          if (payResult.success) {
            paidServices.add(args.service_id);
            emit({
              type: "payment_success",
              message: `✓ Payment approved: ${service.feeLamports / 1e9} SOL → ${service.name}`,
              data: { signature: payResult.signature, service: service.name, amount: service.feeLamports },
              timestamp: Date.now(),
            });
          } else {
            emit({
              type: "payment_denied",
              message: `✗ Payment denied: ${payResult.errorCode || payResult.error}`,
              data: { service: service.name, error: payResult.error, errorCode: payResult.errorCode },
              timestamp: Date.now(),
            });
          }
          result = payResult;
        }

      } else if (toolCall.function.name === "call_service") {
        if (!paidServices.has(args.service_id)) {
          result = { error: "Service not paid for. Complete payment first." };
        } else {
          const service = getServiceById(args.service_id, discoveredServices);
          const data = await callService(args.service_id, service?.serviceUrl);
          emit({
            type: "service_result",
            message: `${service?.name ?? args.service_id} returned data`,
            data: { serviceId: args.service_id, serviceName: service?.name, ...data },
            timestamp: Date.now(),
          });
          result = data;
        }
      }

      toolResults.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    messages.push(...toolResults);
  }
}
