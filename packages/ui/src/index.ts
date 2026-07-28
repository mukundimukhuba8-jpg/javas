import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { package: "ui" });

export const manifest: PackageManifest = {
  name: "@zero/ui",
  version: "0.1.0",
  phase: 6,
  status: "stub",
};

export type HudTheme = "dark";

export interface HudState {
  readonly listening: boolean;
  readonly speaking: boolean;
  readonly currentAgent?: string;
  readonly waveformLevel: number;
  readonly notifications: readonly string[];
}

export interface HudController {
  health(): Promise<HealthStatus>;
  /** Phase 6: Electron transparent HUD */
  mount(): Promise<void>;
  unmount(): Promise<void>;
  setState(partial: Partial<HudState>): void;
  getState(): HudState;
}

export function createHudController(): HudController {
  logger.info("HUD controller stub created — Electron UI begins in Phase 6");

  let state: HudState = {
    listening: false,
    speaking: false,
    waveformLevel: 0,
    notifications: [],
  };

  return {
    health: async () => ({
      name: "@zero/ui",
      healthy: true,
      details: "Stub ready — Electron HUD not yet implemented",
      checkedAt: new Date().toISOString(),
    }),
    mount: async () => {
      logger.warn("HUD mount called on stub");
    },
    unmount: async () => undefined,
    setState: (partial) => {
      state = { ...state, ...partial };
    },
    getState: () => state,
  };
}
