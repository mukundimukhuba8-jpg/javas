import { createLogger, type HealthStatus } from "@zero/shared";
import { loadConfig } from "@zero/config";
import { createAgentOrchestrator, type AgentOrchestrator } from "@zero/agent";
import { createMemoryService } from "@zero/memory";
import { createVoiceEngine } from "@zero/voice";
import { createToolRegistry, type ToolRegistry } from "@zero/tools";
import { createHudController } from "@zero/ui";

const logger = createLogger("info", { app: "desktop" });

export interface DesktopRuntime {
  health(): Promise<readonly HealthStatus[]>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getAgent(): AgentOrchestrator;
}

export interface DesktopRuntimeOptions {
  readonly agent?: AgentOrchestrator;
  readonly tools?: ToolRegistry;
}

/**
 * Phase 2: boots dependency graph with a live agent orchestrator.
 * Phase 6: Electron transparent HUD + system tray + always-on process.
 */
export function createDesktopRuntime(options: DesktopRuntimeOptions = {}): DesktopRuntime {
  const configResult = loadConfig();
  if (!configResult.ok) {
    throw configResult.error;
  }

  const { env } = configResult.value;
  const tools = options.tools ?? createToolRegistry();
  const agent =
    options.agent ??
    createAgentOrchestrator({
      ...(env.ANTHROPIC_API_KEY !== undefined ? { apiKey: env.ANTHROPIC_API_KEY } : {}),
      model: env.ANTHROPIC_MODEL,
      maxTokens: env.ANTHROPIC_MAX_TOKENS,
      maxIterations: env.AGENT_MAX_ITERATIONS,
      maxRetries: env.AGENT_MAX_RETRIES,
      tools,
      logLevel: env.ZERO_LOG_LEVEL,
      registerBuiltins: true,
    });
  const memory = createMemoryService();
  const voice = createVoiceEngine();
  const hud = createHudController();

  return {
    getAgent: () => agent,
    health: async () =>
      Promise.all([agent.health(), memory.health(), voice.health(), tools.health(), hud.health()]),
    start: async () => {
      logger.info("Desktop runtime starting (Phase 2 agent ready — Electron HUD in Phase 6)");
      await hud.mount();
    },
    stop: async () => {
      await hud.unmount();
      logger.info("Desktop runtime stopped");
    },
  };
}

/** Entry used by `node dist/main.js` once Phase 6 wires Electron. */
export async function main(): Promise<void> {
  const runtime = createDesktopRuntime();
  const statuses = await runtime.health();
  for (const status of statuses) {
    logger.info("Subsystem health", {
      name: status.name,
      healthy: status.healthy,
      details: status.details,
    });
  }
  await runtime.start();
}

const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("/main.js") || process.argv[1].endsWith("/main.ts"));

if (isDirectRun) {
  main().catch((error: unknown) => {
    logger.error("Desktop failed to start", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
}
