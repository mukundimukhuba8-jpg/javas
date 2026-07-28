import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { service: "notion" });

export const manifest: PackageManifest = {
  name: "@zero/service-notion",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface NotionService {
  health(): Promise<HealthStatus>;
}

/** Phase 5 stub — Notion API */
export function createNotionService(): NotionService {
  logger.info("@zero/service-notion stub created");
  return {
    health: async () => ({
      name: "@zero/service-notion",
      healthy: true,
      details: "Stub — not yet connected",
      checkedAt: new Date().toISOString(),
    }),
  };
}
