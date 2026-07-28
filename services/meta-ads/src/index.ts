import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { service: "metaAds" });

export const manifest: PackageManifest = {
  name: "@zero/service-meta-ads",
  version: "0.1.0",
  phase: 5,
  status: "stub",
};

export interface MetaAdsService {
  health(): Promise<HealthStatus>;
}

/** Phase 5 stub — Meta Ads API */
export function createMetaAdsService(): MetaAdsService {
  logger.info("@zero/service-meta-ads stub created");
  return {
    health: async () => ({
      name: "@zero/service-meta-ads",
      healthy: true,
      details: "Stub — not yet connected",
      checkedAt: new Date().toISOString(),
    }),
  };
}
