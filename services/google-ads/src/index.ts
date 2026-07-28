import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { service: "googleAds" });

export const manifest: PackageManifest = {
  name: "@zero/service-google-ads",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface GoogleAdsService {
  health(): Promise<HealthStatus>;
}

/** Phase 5 stub — Google Ads API */
export function createGoogleAdsService(): GoogleAdsService {
  logger.info("@zero/service-google-ads stub created");
  return {
    health: async () => ({
      name: "@zero/service-google-ads",
      healthy: true,
      details: "Stub — not yet connected",
      checkedAt: new Date().toISOString(),
    }),
  };
}
