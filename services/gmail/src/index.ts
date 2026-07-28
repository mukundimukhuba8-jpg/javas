import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { service: "gmail" });

export const manifest: PackageManifest = {
  name: "@zero/service-gmail",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface GmailService {
  health(): Promise<HealthStatus>;
}

/** Phase 5 stub — Gmail API */
export function createGmailService(): GmailService {
  logger.info("@zero/service-gmail stub created");
  return {
    health: async () => ({
      name: "@zero/service-gmail",
      healthy: true,
      details: "Stub — not yet connected",
      checkedAt: new Date().toISOString(),
    }),
  };
}
