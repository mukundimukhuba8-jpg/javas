#!/usr/bin/env tsx
/**
 * `npm run zero` / `pnpm zero`
 * Phase 2: validate config, boot agent + stubs, optional `--ask` one-shot.
 */
import { createLogger, isOk } from "@zero/shared";
import { loadConfig } from "@zero/config";
import { createAgentOrchestrator, manifest as agentManifest } from "@zero/agent";
import { createMemoryService, manifest as memoryManifest } from "@zero/memory";
import { createVoiceEngine, manifest as voiceManifest } from "@zero/voice";
import { createToolRegistry, manifest as toolsManifest } from "@zero/tools";
import { createHudController, manifest as uiManifest } from "@zero/ui";
import { createDesktopRuntime } from "@zero/desktop";

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const isDev = process.argv.includes("--dev");
const ask = readFlag("--ask");

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`
╔══════════════════════════════════════════╗
║   Zero — Personal AI Assistant           ║
║   Phase 2 · core agent online            ║
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
    model: env.ANTHROPIC_MODEL,
  });

  const tools = createToolRegistry();
  const agentOptions = {
    ...(env.ANTHROPIC_API_KEY !== undefined ? { apiKey: env.ANTHROPIC_API_KEY } : {}),
    model: env.ANTHROPIC_MODEL,
    maxTokens: env.ANTHROPIC_MAX_TOKENS,
    maxIterations: env.AGENT_MAX_ITERATIONS,
    maxRetries: env.AGENT_MAX_RETRIES,
    tools,
    logLevel: env.ZERO_LOG_LEVEL,
    registerBuiltins: true,
  };

  const agent = createAgentOrchestrator(agentOptions);
  const memory = createMemoryService();
  const voice = createVoiceEngine();
  const hud = createHudController();
  const desktop = createDesktopRuntime({ agent, tools });

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

  // eslint-disable-next-line no-console
  console.log("\nBuiltin tools");
  for (const tool of agent.getTools().list()) {
    // eslint-disable-next-line no-console
    console.log(`  · ${tool.name}`);
  }

  await desktop.start();

  if (ask) {
    // eslint-disable-next-line no-console
    console.log(`\nYou: ${ask}\n`);
    process.stdout.write("Zero: ");
    for await (const event of agent.runStream(ask)) {
      if (event.type === "text_delta") {
        process.stdout.write(event.text);
      } else if (event.type === "tool_call") {
        // eslint-disable-next-line no-console
        console.log(`\n  ↳ tool ${event.request.name}`);
      } else if (event.type === "phase") {
        logger.debug("phase", { phase: event.phase, detail: event.detail });
      }
    }
    process.stdout.write("\n");
  }

  // eslint-disable-next-line no-console
  console.log(`
Zero Phase 2 is online.
Try: pnpm zero --ask "Good evening Zero."
Next: Phase 3 — voice (wake word, Deepgram, ElevenLabs).
`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
