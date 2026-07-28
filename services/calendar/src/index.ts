import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { service: "calendar" });

export const manifest: PackageManifest = {
  name: "@zero/service-calendar",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface CalendarService {
  health(): Promise<HealthStatus>;
}

/** Phase 5 stub — Google Calendar / Cal.com */
export function createCalendarService(): CalendarService {
  logger.info("@zero/service-calendar stub created");
  return {
    health: async () => ({
      name: "@zero/service-calendar",
      healthy: true,
      details: "Stub — not yet connected",
      checkedAt: new Date().toISOString(),
    }),
  };
}
