import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { service: "airtable" });

export const manifest: PackageManifest = {
  name: "@zero/service-airtable",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface AirtableService {
  health(): Promise<HealthStatus>;
}

/** Phase 5 stub — Airtable API */
export function createAirtableService(): AirtableService {
  logger.info("@zero/service-airtable stub created");
  return {
    health: async () => ({
      name: "@zero/service-airtable",
      healthy: true,
      details: "Stub — not yet connected",
      checkedAt: new Date().toISOString(),
    }),
  };
}
