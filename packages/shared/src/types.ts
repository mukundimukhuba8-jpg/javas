/** Shared domain types for Zero. Feature implementations land in later phases. */

export type AgentId =
  | "lead-generation"
  | "email-copywriter"
  | "ads-analyst"
  | "business-analyst"
  | "research"
  | "calendar"
  | "operations"
  | "memory-manager"
  | "orchestrator";

export type ToolName = string;

export interface ToolCallRequest {
  readonly id: string;
  readonly name: ToolName;
  readonly input: Record<string, unknown>;
}

export interface ToolCallResult {
  readonly id: string;
  readonly name: ToolName;
  readonly ok: boolean;
  readonly output: unknown;
  readonly error?: string;
}

export interface ConversationTurn {
  readonly id: string;
  readonly role: "user" | "assistant" | "system" | "tool";
  readonly content: string;
  readonly timestamp: string;
  readonly agentId?: AgentId;
  readonly toolCalls?: readonly ToolCallRequest[];
}

export interface HealthStatus {
  readonly name: string;
  readonly healthy: boolean;
  readonly details?: string;
  readonly checkedAt: string;
}

export interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly phase: number;
  readonly status: "stub" | "partial" | "ready";
}
