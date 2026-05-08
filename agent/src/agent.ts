import OpenAI from "openai";
import { AgentEvent } from "./types";
import {
  discoverServices,
  getServiceById,
  callService,
} from "./tools/services";
import {
  checkPolicyBalance,
  executeConstrainedPayment,
} from "./tools/solana";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "discover_services",
      description:
        "Discover available AI service agents that can be paid for data or computation",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "check_policy_balance",
      description:
        "Check the current policy constraints and how much has been spent today",
      parameters: {
        type: "object",
        properties: {
          owner_address: {
            type: "string",
            description: "The Solana wallet address of the policy owner",
          },
        },
        required: ["owner_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "attempt_payment",
      description:
        "Attempt to pay a service agent. The onchain policy program will validate or reject the transaction.",
      parameters: {
        type: "object",
        properties: {
          service_id: {
            type: "string",
            description: "The service agent ID (from discover_services)",
          },
          owner_address: {
            type: "string",
            description: "The policy owner wallet address",
          },
        },
        required: ["service_id", "owner_address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "call_service",
      description:
        "Call a service to get its data/response (only after successful payment)",
      parameters: {
        type: "object",
        properties: {
          service_id: {
            type: "string",
            description: "The service agent ID",
          },
        },
        required: ["service_id"],
      },
    },
  },
];

export async function runAgent(
  ownerAddress: string,
  emit: (event: AgentEvent) => void
): Promise<void> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are APPL Agent — an autonomous AI agent running on Solana testnet.

Your mission: discover ALL available services, then attempt to pay for and retrieve data from EVERY one of them. Do not stop after the first success.

Workflow (follow this exactly):
1. Call discover_services to see what is available.
2. Call check_policy_balance to understand your spending constraints.
3. For EACH service discovered — attempt_payment, then if approved immediately call call_service to fetch its data.
4. After attempting ALL services, write a concise final summary: what data you retrieved, which payments were blocked by policy and why.

Think out loud as you make each decision. Be specific about why the policy approves or rejects each service.

The policy owner's Solana address is: ${ownerAddress}`,
    },
    {
      role: "user",
      content: "Start your task. Try every service.",
    },
  ];

  let nonce = BigInt(Date.now());
  const paidServices = new Set<string>();

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

    // Emit actual GPT reasoning text whenever it's present
    if (choice.message.content) {
      emit({
        type: "reasoning",
        message: choice.message.content,
        timestamp: Date.now(),
      });
    }

    // Agent sent a final text message — done
    if (choice.finish_reason === "stop") {
      emit({ type: "agent_done", message: choice.message.content || "Done.", timestamp: Date.now() });
      break;
    }

    // Process tool calls
    if (!choice.message.tool_calls?.length) break;

    const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

    for (const toolCall of choice.message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      let result: unknown;

      if (toolCall.function.name === "discover_services") {
        const services = discoverServices();
        emit({
          type: "tool_call",
          message: `Discovering available services...`,
          data: { services: services.map((s) => `${s.name} (${s.feeLamports / 1e9} SOL)`) },
          timestamp: Date.now(),
        });
        result = services;
      } else if (toolCall.function.name === "check_policy_balance") {
        const policy = await checkPolicyBalance(args.owner_address);
        emit({
          type: "tool_call",
          message: policy
            ? `Policy: ${policy.spentToday / 1e9} SOL spent of ${policy.maxDailySpend / 1e9} SOL limit | ${policy.approvedMerchants.length} merchants approved`
            : "No policy found for this agent",
          data: (policy as unknown as Record<string, unknown>) || {},
          timestamp: Date.now(),
        });
        result = policy;
      } else if (toolCall.function.name === "attempt_payment") {
        const service = getServiceById(args.service_id);
        if (!service) {
          result = { success: false, error: "Unknown service" };
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
            nonce++
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
          const data = callService(args.service_id);
          const service = getServiceById(args.service_id);
          emit({
            type: "service_result",
            message: `${service?.name} returned data`,
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
