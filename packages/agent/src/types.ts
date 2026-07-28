import type { AgentId, ConversationTurn, ToolCallRequest, ToolCallResult } from "@zero/shared";

export type ReasoningPhase = "plan" | "execute" | "reflect" | "retry" | "merge";

export type AgentEvent =
  | { readonly type: "phase"; readonly phase: ReasoningPhase; readonly detail?: string }
  | { readonly type: "text_delta"; readonly text: string; readonly agentId: AgentId }
  | { readonly type: "tool_call"; readonly request: ToolCallRequest; readonly agentId: AgentId }
  | { readonly type: "tool_result"; readonly result: ToolCallResult; readonly agentId: AgentId }
  | { readonly type: "plan"; readonly steps: readonly string[]; readonly agentId: AgentId }
  | {
      readonly type: "reflect";
      readonly complete: boolean;
      readonly assessment: string;
      readonly agentId: AgentId;
    }
  | { readonly type: "retry"; readonly attempt: number; readonly reason: string }
  | { readonly type: "done"; readonly turn: ConversationTurn }
  | { readonly type: "error"; readonly message: string; readonly retryable: boolean };

export interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string | readonly ContentBlock[];
}

export type ContentBlock =
  | { readonly type: "text"; readonly text: string }
  | {
      readonly type: "tool_use";
      readonly id: string;
      readonly name: string;
      readonly input: Record<string, unknown>;
    }
  | {
      readonly type: "tool_result";
      readonly tool_use_id: string;
      readonly content: string;
      readonly is_error?: boolean;
    };

export interface LlmTool {
  readonly name: string;
  readonly description: string;
  readonly input_schema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required?: readonly string[];
  };
}

export type LlmStreamEvent =
  | { readonly type: "text_delta"; readonly text: string }
  | {
      readonly type: "tool_use";
      readonly id: string;
      readonly name: string;
      readonly input: Record<string, unknown>;
    }
  | { readonly type: "message_stop"; readonly stopReason: string | null };

export interface LlmCompletion {
  readonly text: string;
  readonly toolUses: readonly {
    readonly id: string;
    readonly name: string;
    readonly input: Record<string, unknown>;
  }[];
  readonly stopReason: string | null;
}

export interface LlmClient {
  complete(params: {
    readonly system: string;
    readonly messages: readonly ChatMessage[];
    readonly tools?: readonly LlmTool[];
    readonly maxTokens?: number;
  }): Promise<LlmCompletion>;

  stream(params: {
    readonly system: string;
    readonly messages: readonly ChatMessage[];
    readonly tools?: readonly LlmTool[];
    readonly maxTokens?: number;
  }): AsyncIterable<LlmStreamEvent>;
}

export interface RunOptions {
  readonly agentId?: AgentId;
  readonly systemAppend?: string;
  readonly signal?: AbortSignal;
  readonly maxIterations?: number;
  readonly maxRetries?: number;
}
