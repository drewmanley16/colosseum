export type AgentEventType =
  | "thinking"
  | "reasoning"
  | "tool_call"
  | "tool_result"
  | "payment_attempt"
  | "payment_success"
  | "payment_denied"
  | "service_result"
  | "agent_done"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface ServiceAgent {
  id: string;
  name: string;
  description: string;
  wallet: string;
  feeLamports: number;
  category: string;
}

export interface PolicyState {
  maxDailySpend: number;
  spentToday: number;
  approvedMerchants: string[];
  expiry: number;
  isActive: boolean;
}

export interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
  errorCode?: string;
}
