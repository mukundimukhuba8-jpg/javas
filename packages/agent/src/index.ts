import {
  type AgentId,
  type ConversationTurn,
  type HealthStatus,
  type PackageManifest,
  createLogger,
} from "@zero/shared";

const logger = createLogger("info", { package: "agent" });

export const manifest: PackageManifest = {
  name: "@zero/agent",
  version: "0.1.0",
  phase: 2,
  status: "stub",
};

export interface AgentRuntime {
  readonly id: AgentId;
  health(): Promise<HealthStatus>;
  /**
   * Phase 2: Claude tool-use loop with planner → execute → reflect → retry.
   */
  run(_prompt: string): Promise<ConversationTurn>;
}

export interface AgentOrchestrator {
  health(): Promise<HealthStatus>;
  listAgents(): readonly AgentId[];
  /**
   * Phase 2 / swarm: fan out to specialized agents and merge results.
   */
  runSwarm(_prompt: string, _agents?: readonly AgentId[]): Promise<ConversationTurn>;
}

const SPECIALISTS: readonly AgentId[] = [
  "orchestrator",
  "lead-generation",
  "email-copywriter",
  "ads-analyst",
  "business-analyst",
  "research",
  "calendar",
  "operations",
  "memory-manager",
] as const;

export function createAgentOrchestrator(): AgentOrchestrator {
  logger.info("Agent orchestrator stub created — implementation begins in Phase 2");

  return {
    listAgents: () => SPECIALISTS,
    health: async () => ({
      name: "@zero/agent",
      healthy: true,
      details: "Stub ready — Claude reasoning loop not yet implemented",
      checkedAt: new Date().toISOString(),
    }),
    runSwarm: async (_prompt) => ({
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Agent swarm is not yet available. Phase 2 will implement the Claude reasoning loop.",
      timestamp: new Date().toISOString(),
      agentId: "orchestrator",
    }),
  };
}
