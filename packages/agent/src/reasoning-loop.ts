import { createLogger, type AgentId, type Logger, type ToolCallRequest } from "@zero/shared";
import type { ToolRegistry } from "@zero/tools";
import { assistantBlocksFromCompletion } from "./anthropic-llm.js";
import { toolsToLlmSchema } from "./builtins.js";
import { PLAN_INSTRUCTION, REFLECT_INSTRUCTION, buildSystemPrompt } from "./prompts.js";
import type {
  AgentEvent,
  ChatMessage,
  ContentBlock,
  LlmClient,
  LlmCompletion,
  RunOptions,
} from "./types.js";

export interface ReasoningLoopOptions {
  readonly llm: LlmClient;
  readonly tools: ToolRegistry;
  readonly prompt: string;
  readonly agentId: AgentId;
  readonly baseSystemPrompt: string;
  readonly run?: RunOptions;
  readonly maxTokens: number;
  readonly logger?: Logger;
}

function parsePlanSteps(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]/.test(line))
    .map((line) => line.replace(/^\d+[.)]\s*/, ""));
}

function parseReflection(text: string): { complete: boolean; assessment: string } {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return { complete: true, assessment: text.trim() || "No further action required." };
  }
  try {
    const parsed = JSON.parse(match[0]) as { complete?: unknown; assessment?: unknown };
    return {
      complete: Boolean(parsed.complete),
      assessment:
        typeof parsed.assessment === "string" && parsed.assessment.length > 0
          ? parsed.assessment
          : "Assessment unavailable.",
    };
  } catch {
    return {
      complete: true,
      assessment: text.trim() || "Unable to parse reflection; proceeding.",
    };
  }
}

async function* streamCompletion(
  llm: LlmClient,
  params: {
    readonly system: string;
    readonly messages: readonly ChatMessage[];
    readonly tools?: ReturnType<typeof toolsToLlmSchema>;
    readonly maxTokens: number;
    readonly agentId: AgentId;
    readonly emitText: boolean;
  },
): AsyncGenerator<AgentEvent, LlmCompletion> {
  const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = [];
  const textParts: string[] = [];
  let stopReason: string | null = null;

  for await (const event of llm.stream({
    system: params.system,
    messages: params.messages,
    ...(params.tools && params.tools.length > 0 ? { tools: params.tools } : {}),
    maxTokens: params.maxTokens,
  })) {
    if (event.type === "text_delta") {
      textParts.push(event.text);
      if (params.emitText) {
        yield { type: "text_delta", text: event.text, agentId: params.agentId };
      }
    } else if (event.type === "tool_use") {
      toolUses.push({ id: event.id, name: event.name, input: event.input });
    } else if (event.type === "message_stop") {
      stopReason = event.stopReason;
    }
  }

  return {
    text: textParts.join(""),
    toolUses,
    stopReason,
  };
}

export async function* runReasoningLoop(options: ReasoningLoopOptions): AsyncGenerator<AgentEvent> {
  const logger =
    options.logger ?? createLogger("info", { package: "agent", agentId: options.agentId });
  const maxIterations = options.run?.maxIterations ?? 12;
  const maxRetries = options.run?.maxRetries ?? 2;
  const llmTools = toolsToLlmSchema(options.tools);

  const system = buildSystemPrompt({
    base: options.baseSystemPrompt,
    ...(options.agentId !== "orchestrator" ? { agentId: options.agentId } : {}),
    ...(options.run?.systemAppend !== undefined ? { append: options.run.systemAppend } : {}),
  });

  const messages: ChatMessage[] = [{ role: "user", content: options.prompt }];
  const collectedToolCalls: ToolCallRequest[] = [];
  let finalText = "";

  try {
    // ── PLAN ──────────────────────────────────────────────────
    yield { type: "phase", phase: "plan", detail: "Drafting execution plan" };
    const planCompletion = await options.llm.complete({
      system: `${system}\n\n${PLAN_INSTRUCTION}`,
      messages,
      maxTokens: Math.min(1024, options.maxTokens),
    });
    const steps = parsePlanSteps(planCompletion.text);
    yield {
      type: "plan",
      steps: steps.length > 0 ? steps : [planCompletion.text.trim() || "Proceed directly."],
      agentId: options.agentId,
    };

    messages.push({
      role: "assistant",
      content: planCompletion.text || "1. Address the request directly.",
    });
    messages.push({
      role: "user",
      content:
        "Plan acknowledged. Execute it now. Use tools when helpful. Provide a calm, concise final answer when finished.",
    });

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        yield {
          type: "retry",
          attempt,
          reason: "Reflection indicated the goal is incomplete",
        };
        yield { type: "phase", phase: "retry", detail: `Attempt ${attempt + 1}` };
      }

      // ── EXECUTE ─────────────────────────────────────────────
      yield {
        type: "phase",
        phase: "execute",
        detail: `Tool-use loop (max ${maxIterations} iterations)`,
      };

      let turnText = "";
      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        if (options.run?.signal?.aborted) {
          yield { type: "error", message: "Run aborted", retryable: false };
          return;
        }

        const completion = yield* streamCompletion(options.llm, {
          system,
          messages,
          tools: llmTools,
          maxTokens: options.maxTokens,
          agentId: options.agentId,
          emitText: true,
        });

        turnText += completion.text;

        if (completion.toolUses.length === 0) {
          finalText = turnText.trim();
          break;
        }

        const assistantContent = assistantBlocksFromCompletion(completion);
        messages.push({ role: "assistant", content: assistantContent });

        const toolResultBlocks: ContentBlock[] = [];
        for (const toolUse of completion.toolUses) {
          const request: ToolCallRequest = {
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input,
          };
          collectedToolCalls.push(request);
          yield { type: "tool_call", request, agentId: options.agentId };

          const result = await options.tools.invoke(request);
          yield { type: "tool_result", result, agentId: options.agentId };

          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result.ok ? result.output : { error: result.error }),
            ...(result.ok ? {} : { is_error: true as const }),
          });
        }

        // Anthropic expects tool results as a user message
        messages.push({ role: "user", content: toolResultBlocks });
      }

      if (!finalText) {
        finalText = turnText.trim();
      }

      // ── REFLECT ─────────────────────────────────────────────
      yield { type: "phase", phase: "reflect", detail: "Checking whether the goal is met" };
      const reflectionMessages: ChatMessage[] = [
        ...messages,
        {
          role: "user",
          content: REFLECT_INSTRUCTION,
        },
      ];
      const reflection = await options.llm.complete({
        system,
        messages: reflectionMessages,
        maxTokens: 512,
      });
      const { complete, assessment } = parseReflection(reflection.text);
      yield {
        type: "reflect",
        complete,
        assessment,
        agentId: options.agentId,
      };

      if (complete) {
        break;
      }

      if (attempt === maxRetries) {
        logger.warn("Max retries reached; returning best effort answer", {
          agentId: options.agentId,
        });
        break;
      }

      messages.push({
        role: "user",
        content: `Reflection: the goal is not yet complete. ${assessment} Continue and finish the remaining work.`,
      });
    }

    if (!finalText) {
      finalText =
        "I reviewed the request but could not produce a final answer. Please try again momentarily.";
    }

    yield {
      type: "done",
      turn: {
        id: crypto.randomUUID(),
        role: "assistant",
        content: finalText,
        timestamp: new Date().toISOString(),
        agentId: options.agentId,
        ...(collectedToolCalls.length > 0 ? { toolCalls: collectedToolCalls } : {}),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Reasoning loop failed", { error: message });
    yield { type: "error", message, retryable: true };
    yield {
      type: "done",
      turn: {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I apologise — I encountered an error while processing that request. ${message}`,
        timestamp: new Date().toISOString(),
        agentId: options.agentId,
      },
    };
  }
}
