import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { service: "telegram" });

export const manifest: PackageManifest = {
  name: "@zero/service-telegram",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface TelegramService {
  health(): Promise<HealthStatus>;
}

/** Phase 5 stub — Telegram Bot API */
export function createTelegramService(): TelegramService {
  logger.info("@zero/service-telegram stub created");
  return {
    health: async () => ({
      name: "@zero/service-telegram",
      healthy: true,
      details: "Stub — not yet connected",
      checkedAt: new Date().toISOString(),
    }),
  };
}
