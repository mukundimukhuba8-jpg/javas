import type { AgentId, ConversationTurn } from "@zero/shared";
import type { ToolRegistry } from "@zero/tools";
import { runReasoningLoop } from "./reasoning-loop.js";
import type { AgentEvent, LlmClient, RunOptions } from "./types.js";

export interface SwarmOptions {
  readonly llm: LlmClient;
  readonly tools: ToolRegistry;
  readonly prompt: string;
  readonly agents: readonly AgentId[];
  readonly baseSystemPrompt: string;
  readonly maxTokens: number;
  readonly run?: RunOptions;
}

/**
 * Run specialists in parallel, then ask the orchestrator LLM to merge into one reply.
 */
export async function* runSwarm(options: SwarmOptions): AsyncGenerator<AgentEvent> {
  yield {
    type: "phase",
    phase: "execute",
    detail: `Swarm starting (${options.agents.join(", ")})`,
  };

  const specialistResults = await Promise.all(
    options.agents.map(async (agentId) => {
      const events: AgentEvent[] = [];
      let turn: ConversationTurn | undefined;
      for await (const event of runReasoningLoop({
        llm: options.llm,
        tools: options.tools,
        prompt: options.prompt,
        agentId,
        baseSystemPrompt: options.baseSystemPrompt,
        maxTokens: options.maxTokens,
        ...(options.run ? { run: options.run } : {}),
      })) {
        events.push(event);
        if (event.type === "done") {
          turn = event.turn;
        }
      }
      return { agentId, events, turn };
    }),
  );

  for (const result of specialistResults) {
    for (const event of result.events) {
      if (event.type !== "done") {
        yield event;
      }
    }
  }

  yield { type: "phase", phase: "merge", detail: "Merging specialist reports" };

  const reports = specialistResults
    .map((result) => {
      const content = result.turn?.content ?? "(no response)";
      return `### ${result.agentId}\n${content}`;
    })
    .join("\n\n");

  const mergePrompt = `You are Zero's orchestrator. Merge the specialist reports below into one calm British butler response for the user.
Remove duplication. Keep the most important facts and recommendations. Offer a clear next action when appropriate.

User request:
${options.prompt}

Specialist reports:
${reports}`;

  let mergedText = "";
  for await (const event of runReasoningLoop({
    llm: options.llm,
    tools: options.tools,
    prompt: mergePrompt,
    agentId: "orchestrator",
    baseSystemPrompt: options.baseSystemPrompt,
    maxTokens: options.maxTokens,
    run: {
      ...(options.run ?? {}),
      maxRetries: 0,
      systemAppend:
        "You are merging parallel specialist output. Prefer synthesis over repeating every detail.",
    },
  })) {
    if (event.type === "text_delta") {
      mergedText += event.text;
      yield event;
    } else if (event.type === "plan" || event.type === "phase" || event.type === "reflect") {
      yield event;
    } else if (event.type === "tool_call" || event.type === "tool_result") {
      yield event;
    } else if (event.type === "done") {
      yield event;
      return;
    } else if (event.type === "error") {
      yield event;
    }
  }

  yield {
    type: "done",
    turn: {
      id: crypto.randomUUID(),
      role: "assistant",
      content: mergedText || "I was unable to merge specialist reports.",
      timestamp: new Date().toISOString(),
      agentId: "orchestrator",
    },
  };
}
