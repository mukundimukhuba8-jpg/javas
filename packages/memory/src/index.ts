import { type HealthStatus, type PackageManifest, createLogger } from "@zero/shared";

const logger = createLogger("info", { package: "memory" });

export const manifest: PackageManifest = {
  name: "@zero/memory",
  version: "0.1.0",
  phase: 4,
  status: "stub",
};

export interface MemoryRecord {
  readonly id: string;
  readonly category:
    | "identity"
    | "business"
    | "client"
    | "preference"
    | "style"
    | "goal"
    | "task"
    | "product"
    | "project"
    | "prompt";
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DailyContextDocument {
  readonly name: string;
  readonly path: string;
  readonly content: string;
}

export interface MemoryService {
  health(): Promise<HealthStatus>;
  /** Phase 4: SQLite long-term store */
  remember(_record: Omit<MemoryRecord, "id" | "createdAt" | "updatedAt">): Promise<MemoryRecord>;
  /** Phase 4: vector similarity search (LanceDB) */
  recall(_query: string, _limit?: number): Promise<readonly MemoryRecord[]>;
  /** Phase 4: load business/daily/*.md on startup */
  loadDailyContext(_dir?: string): Promise<readonly DailyContextDocument[]>;
}

export function createMemoryService(): MemoryService {
  logger.info("Memory service stub created — implementation begins in Phase 4");

  return {
    health: async () => ({
      name: "@zero/memory",
      healthy: true,
      details: "Stub ready — SQLite + LanceDB not yet wired",
      checkedAt: new Date().toISOString(),
    }),
    remember: async (record) => {
      const now = new Date().toISOString();
      return {
        id: crypto.randomUUID(),
        ...record,
        createdAt: now,
        updatedAt: now,
      };
    },
    recall: async () => [],
    loadDailyContext: async () => [],
  };
}
