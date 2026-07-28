#!/usr/bin/env tsx
/**
 * `npm run zero` / `pnpm zero`
 * Phase 1: validate config, boot stubs, print health report.
 * Later phases: desktop + voice + memory + tools as a single always-on process.
 */
import { createLogger, isOk } from "@zero/shared";
import { loadConfig } from "@zero/config";
import { createAgentOrchestrator, manifest as agentManifest } from "@zero/agent";
import { createMemoryService, manifest as memoryManifest } from "@zero/memory";
import { createVoiceEngine, manifest as voiceManifest } from "@zero/voice";
import { createToolRegistry, manifest as toolsManifest } from "@zero/tools";
import { createHudController, manifest as uiManifest } from "@zero/ui";
import { createDesktopRuntime } from "@zero/desktop";

const isDev = process.argv.includes("--dev");

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`
╔══════════════════════════════════════════╗
║   Zero — Personal AI Assistant           ║
║   Phase 1 scaffold · always-on ready     ║
╚══════════════════════════════════════════╝
`);

  const configResult = loadConfig();
  if (!isOk(configResult)) {
    console.error("Configuration validation failed:");
    for (const issue of configResult.error.issues) {
      console.error(`  • ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  const { env, integrations } = configResult.value;
  const logger = createLogger(env.ZERO_LOG_LEVEL, { component: "zero-cli" });

  logger.info("Starting Zero", {
    mode: isDev ? "development" : env.NODE_ENV,
    alwaysOn: env.ZERO_ALWAYS_ON,
  });

  const agent = createAgentOrchestrator();
  const memory = createMemoryService();
  const voice = createVoiceEngine();
  const tools = createToolRegistry();
  const hud = createHudController();
  const desktop = createDesktopRuntime();

  const packages = [agentManifest, memoryManifest, voiceManifest, toolsManifest, uiManifest];
  const health = await Promise.all([
    agent.health(),
    memory.health(),
    voice.health(),
    tools.health(),
    hud.health(),
  ]);

  // eslint-disable-next-line no-console
  console.log("\nPackage status");
  for (const m of packages) {
    // eslint-disable-next-line no-console
    console.log(`  ${m.name.padEnd(16)} phase ${m.phase} · ${m.status}`);
  }

  // eslint-disable-next-line no-console
  console.log("\nSubsystem health");
  for (const status of health) {
    const mark = status.healthy ? "✓" : "✗";
    // eslint-disable-next-line no-console
    console.log(`  ${mark} ${status.name}: ${status.details ?? "ok"}`);
  }

  // eslint-disable-next-line no-console
  console.log("\nIntegrations");
  for (const integration of integrations) {
    const mark = integration.configured ? "✓" : "·";
    const detail = integration.configured
      ? "configured"
      : `pending keys: ${integration.requiredKeys.join(", ")}`;
    // eslint-disable-next-line no-console
    console.log(`  ${mark} ${integration.id.padEnd(14)} ${detail}`);
  }

  await desktop.start();

  // eslint-disable-next-line no-console
  console.log(`
Zero Phase 1 is online.
Next: Phase 2 — core agent (Claude tool-use loop).
`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
