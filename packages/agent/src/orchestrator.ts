import { resolve } from "node:path";
import {
  createLogger,
  type AgentId,
  type ConversationTurn,
  type HealthStatus,
  type LogLevel,
  type PackageManifest,
} from "@zero/shared";
import { createToolRegistry, type ToolRegistry } from "@zero/tools";
import { createAnthropicLlm } from "./anthropic-llm.js";
import { registerBuiltinTools } from "./builtins.js";
import { loadClaudeSystemPrompt } from "./prompts.js";
import { runReasoningLoop } from "./reasoning-loop.js";
import { ALL_SPECIALISTS, selectSwarmAgents } from "./specialists.js";
import { runSwarm } from "./swarm.js";
import type { AgentEvent, LlmClient, RunOptions } from "./types.js";

export const manifest: PackageManifest = {
  name: "@zero/agent",
  version: "0.1.0",
  phase: 2,
  status: "partial",
};

export interface AgentRuntime {
  readonly id: AgentId;
  health(): Promise<HealthStatus>;
  run(prompt: string, options?: RunOptions): Promise<ConversationTurn>;
  runStream(prompt: string, options?: RunOptions): AsyncIterable<AgentEvent>;
}

export interface AgentOrchestrator {
  health(): Promise<HealthStatus>;
  listAgents(): readonly AgentId[];
  getTools(): ToolRegistry;
  run(prompt: string, options?: RunOptions): Promise<ConversationTurn>;
  runStream(prompt: string, options?: RunOptions): AsyncIterable<AgentEvent>;
  runSwarm(prompt: string, agents?: readonly AgentId[]): Promise<ConversationTurn>;
  runSwarmStream(prompt: string, agents?: readonly AgentId[]): AsyncIterable<AgentEvent>;
}

export interface AgentOrchestratorOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly maxIterations?: number;
  readonly maxRetries?: number;
  readonly tools?: ToolRegistry;
  readonly llm?: LlmClient;
  readonly logLevel?: LogLevel;
  readonly businessDailyPath?: string;
  readonly systemPrompt?: string;
  readonly registerBuiltins?: boolean;
}

async function collectDone(events: AsyncIterable<AgentEvent>): Promise<ConversationTurn> {
  let turn: ConversationTurn | undefined;
  for await (const event of events) {
    if (event.type === "done") {
      turn = event.turn;
    }
  }
  if (!turn) {
    throw new Error("Agent stream ended without a done event");
  }
  return turn;
}

export function createAgentOrchestrator(options: AgentOrchestratorOptions = {}): AgentOrchestrator {
  const logLevel = options.logLevel ?? "info";
  const logger = createLogger(logLevel, { package: "agent" });
  const model = options.model ?? "claude-sonnet-5";
  const maxTokens = options.maxTokens ?? 8192;
  const maxIterations = options.maxIterations ?? 12;
  const maxRetries = options.maxRetries ?? 2;
  const businessDailyPath = options.businessDailyPath ?? resolve(process.cwd(), "business/daily");
  const baseSystemPrompt = options.systemPrompt ?? loadClaudeSystemPrompt();

  const tools = options.tools ?? createToolRegistry();
  if (options.registerBuiltins !== false) {
    registerBuiltinTools(tools, { businessDailyPath });
  }

  const llm: LlmClient | undefined =
    options.llm ??
    (options.apiKey ? createAnthropicLlm({ apiKey: options.apiKey, model, maxTokens }) : undefined);

  const configured = Boolean(llm);
  logger.info("Agent orchestrator ready", {
    model,
    configured,
    tools: tools.list().map((t) => t.name),
  });

  const defaultRun = (run?: RunOptions): RunOptions => ({
    maxIterations: run?.maxIterations ?? maxIterations,
    maxRetries: run?.maxRetries ?? maxRetries,
    ...(run?.agentId !== undefined ? { agentId: run.agentId } : {}),
    ...(run?.systemAppend !== undefined ? { systemAppend: run.systemAppend } : {}),
    ...(run?.signal !== undefined ? { signal: run.signal } : {}),
  });

  async function* unavailableStream(prompt: string): AsyncGenerator<AgentEvent> {
    const content =
      "Good evening. My reasoning systems are standing by, but the Anthropic API key is not configured yet. Add ANTHROPIC_API_KEY to your environment and I shall continue.";
    logger.debug("Agent run requested without Anthropic configuration", {
      promptLength: prompt.length,
    });
    yield { type: "phase", phase: "execute", detail: "Anthropic not configured" };
    yield { type: "text_delta", text: content, agentId: "orchestrator" };
    yield {
      type: "done",
      turn: {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
        agentId: "orchestrator",
      },
    };
  }

  async function* runStream(prompt: string, run?: RunOptions): AsyncGenerator<AgentEvent> {
    if (!llm) {
      yield* unavailableStream(prompt);
      return;
    }
    const agentId = run?.agentId ?? "orchestrator";
    yield* runReasoningLoop({
      llm,
      tools,
      prompt,
      agentId,
      baseSystemPrompt,
      maxTokens,
      run: defaultRun(run),
      logger,
    });
  }

  async function* runSwarmStream(
    prompt: string,
    agents?: readonly AgentId[],
  ): AsyncGenerator<AgentEvent> {
    if (!llm) {
      yield* unavailableStream(prompt);
      return;
    }
    const selected = selectSwarmAgents(prompt, agents);
    yield* runSwarm({
      llm,
      tools,
      prompt,
      agents: selected,
      baseSystemPrompt,
      maxTokens,
      run: defaultRun({ maxRetries: 0 }),
    });
  }

  return {
    listAgents: () => ALL_SPECIALISTS,
    getTools: () => tools,
    health: async () => ({
      name: "@zero/agent",
      healthy: true,
      details: configured
        ? `Ready · model ${model} · ${tools.list().length} tools`
        : "Partial — set ANTHROPIC_API_KEY to enable the reasoning loop",
      checkedAt: new Date().toISOString(),
    }),
    run: async (prompt, run) => collectDone(runStream(prompt, run)),
    runStream: (prompt, run) => runStream(prompt, run),
    runSwarm: async (prompt, agents) => collectDone(runSwarmStream(prompt, agents)),
    runSwarmStream: (prompt, agents) => runSwarmStream(prompt, agents),
  };
}

export function createAgentRuntime(
  id: AgentId,
  options: AgentOrchestratorOptions = {},
): AgentRuntime {
  const orchestrator = createAgentOrchestrator(options);
  return {
    id,
    health: () => orchestrator.health(),
    run: (prompt, run) => orchestrator.run(prompt, { ...(run ?? {}), agentId: id }),
    runStream: (prompt, run) => orchestrator.runStream(prompt, { ...(run ?? {}), agentId: id }),
  };
}
