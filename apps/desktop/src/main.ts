import { createLogger, type HealthStatus } from "@zero/shared";
import { loadConfig } from "@zero/config";
import { createAgentOrchestrator } from "@zero/agent";
import { createMemoryService } from "@zero/memory";
import { createVoiceEngine } from "@zero/voice";
import { createToolRegistry } from "@zero/tools";
import { createHudController } from "@zero/ui";

const logger = createLogger("info", { app: "desktop" });

export interface DesktopRuntime {
  health(): Promise<readonly HealthStatus[]>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Phase 1: boots dependency graph and reports health.
 * Phase 6: Electron transparent HUD + system tray + always-on process.
 */
export function createDesktopRuntime(): DesktopRuntime {
  const configResult = loadConfig();
  if (!configResult.ok) {
    throw configResult.error;
  }

  const agent = createAgentOrchestrator();
  const memory = createMemoryService();
  const voice = createVoiceEngine();
  const tools = createToolRegistry();
  const hud = createHudController();

  return {
    health: async () =>
      Promise.all([agent.health(), memory.health(), voice.health(), tools.health(), hud.health()]),
    start: async () => {
      logger.info("Desktop runtime starting (Phase 1 stub — Electron HUD in Phase 6)");
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
