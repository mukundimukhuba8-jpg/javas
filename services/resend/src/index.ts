import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { service: "resend" });

export const manifest: PackageManifest = {
  name: "@zero/service-resend",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface ResendService {
  health(): Promise<HealthStatus>;
}

/** Phase 5 stub — Resend email API */
export function createResendService(): ResendService {
  logger.info("@zero/service-resend stub created");
  return {
    health: async () => ({
      name: "@zero/service-resend",
      healthy: true,
      details: "Stub — not yet connected",
      checkedAt: new Date().toISOString(),
    }),
  };
}
