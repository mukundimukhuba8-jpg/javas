import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { service: "tavily" });

export const manifest: PackageManifest = {
  name: "@zero/service-tavily",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface TavilyService {
  health(): Promise<HealthStatus>;
}

/** Phase 5 stub — Tavily research API */
export function createTavilyService(): TavilyService {
  logger.info("@zero/service-tavily stub created");
  return {
    health: async () => ({
      name: "@zero/service-tavily",
      healthy: true,
      details: "Stub — not yet connected",
      checkedAt: new Date().toISOString(),
    }),
  };
}
