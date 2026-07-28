import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { service: "braveSearch" });

export const manifest: PackageManifest = {
  name: "@zero/service-brave-search",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface BraveSearchService {
  health(): Promise<HealthStatus>;
}

/** Phase 5 stub — Brave Search API */
export function createBraveSearchService(): BraveSearchService {
  logger.info("@zero/service-brave-search stub created");
  return {
    health: async () => ({
      name: "@zero/service-brave-search",
      healthy: true,
      details: "Stub — not yet connected",
      checkedAt: new Date().toISOString(),
    }),
  };
}
